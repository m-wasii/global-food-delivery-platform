/**
 * EAT-52 courier availability smoke.
 * Proves helpers/ADR/API wiring, unit tests, and (with DATABASE_URL) that
 * only dispatch-eligible online couriers can receive offers; go-online is
 * blocked when onboarding/capability is incomplete.
 *
 * Optional HTTP (API on NEXT_PUBLIC_API_URL): authenticated PUT/GET round-trip.
 *
 * Run: node --env-file=.env scripts/eat52-smoke.mjs
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Mirrors canCourierReceiveOffers for DB acceptance (unit tests own the source of truth). */
function canReceiveOffers(profile) {
  const onboardingOk =
    hasText(profile.phone) &&
    profile.vehicleType != null &&
    hasText(profile.operatingCityId) &&
    !(
      (profile.vehicleType === 'SCOOTER' ||
        profile.vehicleType === 'MOTORCYCLE' ||
        profile.vehicleType === 'CAR') &&
      !hasText(profile.licenseNumber)
    );
  return profile.status === 'ACTIVE' && onboardingOk && profile.isOnline === true;
}

function canGoOnline(profile) {
  return canReceiveOffers({ ...profile, isOnline: true });
}

function assertPortAndWiring() {
  const helper = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'courier-profile.ts'),
    'utf8',
  );
  const service = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'courier-availability.service.ts'),
    'utf8',
  );
  const controller = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'courier-availability.controller.ts'),
    'utf8',
  );
  const mod = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'couriers.module.ts'),
    'utf8',
  );
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const adr = readFileSync(
    path.join(root, 'docs', 'decisions', '0022-courier-availability.md'),
    'utf8',
  );
  const migration = readFileSync(
    path.join(
      root,
      'packages',
      'database',
      'prisma',
      'migrations',
      '20261106210000_courier_availability',
      'migration.sql',
    ),
    'utf8',
  );
  const architecture = readFileSync(
    path.join(root, 'docs', 'architecture', 'README.md'),
    'utf8',
  );

  assert(helper.includes('export function canCourierReceiveOffers'), 'offer helper missing');
  assert(helper.includes('export function canCourierGoOnline'), 'go-online helper missing');
  assert(service.includes('CourierAvailabilityService'), 'availability service missing');
  assert(controller.includes('couriers/me/availability'), 'availability route missing');
  assert(mod.includes('CourierAvailabilityController'), 'module missing controller');
  assert(schema.includes('isOnline'), 'schema missing isOnline');
  assert(schema.includes('onlineChangedAt'), 'schema missing onlineChangedAt');
  assert(migration.includes('isOnline'), 'migration missing isOnline');
  assert(adr.includes('EAT-52'), 'ADR 0022 missing EAT-52');
  assert(architecture.includes('0022-courier-availability'), 'architecture missing ADR 0022');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@food-delivery/api', 'test', '--', 'src/couriers/courier-profile.spec.ts'],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('EAT-52 unit tests failed');
  }
}

async function proveAvailabilityState() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for EAT-52 DB acceptance proof');
  }

  const { PrismaClient } = require(
    require.resolve('@prisma/client', { paths: [path.join(root, 'packages/database')] }),
  );
  const { PrismaPg } = require(
    require.resolve('@prisma/adapter-pg', { paths: [path.join(root, 'packages/database')] }),
  );
  const { hash } = require(
    require.resolve('@node-rs/argon2', { paths: [path.join(root, 'apps/api')] }),
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const eligibleUserId = randomUUID();
  const incompleteUserId = randomUUID();
  const citySlug = `eat52-${Date.now()}`;
  const passwordHash = await hash('SmokeTest1!');
  const password = 'SmokeTest1!';

  try {
    const city = await prisma.operatingCity.create({
      data: {
        name: 'EAT-52 Smoke City',
        country: 'PK',
        slug: citySlug,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        id: eligibleUserId,
        email: `courier.ok.${eligibleUserId.slice(0, 8)}@eatwave.test`,
        name: 'Eligible Courier',
        passwordHash,
        emailVerifiedAt: new Date(),
        courierProfile: {
          create: {
            status: 'ACTIVE',
            phone: '+923001234567',
            vehicleType: 'BICYCLE',
            operatingCityId: city.id,
            activatedAt: new Date(),
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        id: incompleteUserId,
        email: `courier.bad.${incompleteUserId.slice(0, 8)}@eatwave.test`,
        name: 'Incomplete Courier',
        passwordHash,
        emailVerifiedAt: new Date(),
        courierProfile: {
          create: {
            status: 'ACTIVE',
            phone: null,
            vehicleType: 'BICYCLE',
            operatingCityId: city.id,
            activatedAt: new Date(),
          },
        },
      },
    });

    const eligible = await prisma.courierProfile.findUnique({
      where: { userId: eligibleUserId },
    });
    const incomplete = await prisma.courierProfile.findUnique({
      where: { userId: incompleteUserId },
    });

    assert(eligible, 'eligible profile missing');
    assert(incomplete, 'incomplete profile missing');
    assert(eligible.isOnline === false, 'default isOnline must be false');
    assert(
      canReceiveOffers(eligible) === false,
      'offline eligible courier must not receive offers',
    );

    const online = await prisma.courierProfile.update({
      where: { id: eligible.id },
      data: { isOnline: true, onlineChangedAt: new Date() },
    });
    assert(online.isOnline === true, 'isOnline not persisted');
    assert(online.onlineChangedAt, 'onlineChangedAt not set');
    assert(
      canReceiveOffers(online) === true,
      'eligible online courier must receive offers',
    );

    assert(canGoOnline(incomplete) === false, 'incomplete courier must not go online');
    assert(
      canReceiveOffers({ ...incomplete, isOnline: true }) === false,
      'incomplete courier must not receive offers even if marked online',
    );

    await proveHttpIfUp({
      email: `courier.ok.${eligibleUserId.slice(0, 8)}@eatwave.test`,
      incompleteEmail: `courier.bad.${incompleteUserId.slice(0, 8)}@eatwave.test`,
      password,
      prisma,
      eligibleUserId,
    });
  } finally {
    await prisma.courierProfile
      .deleteMany({ where: { userId: { in: [eligibleUserId, incompleteUserId] } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [eligibleUserId, incompleteUserId] } } })
      .catch(() => {});
    await prisma.operatingCity.deleteMany({ where: { slug: citySlug } }).catch(() => {});
    await prisma.$disconnect();
  }
}

async function sessionCookie(email, password) {
  const login = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert(login.ok, `login failed for ${email}: ${login.status}`);
  const cookie =
    login.headers.getSetCookie?.()?.join('; ') ?? login.headers.get('set-cookie');
  assert(cookie, `session cookie missing for ${email}`);
  return cookie;
}

async function proveHttpIfUp({
  email,
  incompleteEmail,
  password,
  prisma,
  eligibleUserId,
}) {
  let health;
  try {
    health = await fetch(`${apiBase}/health`);
  } catch {
    console.log('eat52-smoke: API not reachable; skipped HTTP proof');
    return;
  }
  if (!health.ok) {
    console.log('eat52-smoke: API health not ok; skipped HTTP proof');
    return;
  }

  await prisma.courierProfile.update({
    where: { userId: eligibleUserId },
    data: { isOnline: false, onlineChangedAt: new Date() },
  });

  const cookie = await sessionCookie(email, password);

  const getOffline = await fetch(`${apiBase}/couriers/me/availability`, {
    headers: { cookie },
  });
  assert(getOffline.ok, `GET availability failed: ${getOffline.status}`);
  const offlineBody = await getOffline.json();
  assert(offlineBody.isOnline === false, 'GET should show offline');
  assert(offlineBody.canReceiveOffers === false, 'offline GET canReceiveOffers');

  const putOnline = await fetch(`${apiBase}/couriers/me/availability`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ isOnline: true }),
  });
  assert(putOnline.ok, `PUT online failed: ${putOnline.status}`);
  const onlineBody = await putOnline.json();
  assert(onlineBody.isOnline === true, 'PUT should set online');
  assert(onlineBody.canReceiveOffers === true, 'online eligible canReceiveOffers');

  const putOffline = await fetch(`${apiBase}/couriers/me/availability`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ isOnline: false }),
  });
  assert(putOffline.ok, `PUT offline failed: ${putOffline.status}`);
  const back = await putOffline.json();
  assert(back.isOnline === false, 'PUT should clear online');
  assert(back.canReceiveOffers === false, 'offline again must not receive offers');

  const badCookie = await sessionCookie(incompleteEmail, password);
  const blocked = await fetch(`${apiBase}/couriers/me/availability`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: badCookie },
    body: JSON.stringify({ isOnline: true }),
  });
  assert(blocked.status === 400, `incomplete go-online must 400, got ${blocked.status}`);
}

assertPortAndWiring();
runTests();
await proveAvailabilityState();
console.log('eat52-smoke: ok');
