/**
 * EAT-51 courier model smoke.
 * Proves schema/ADR/helpers, unit tests, and (with DATABASE_URL) that a
 * CourierProfile is distinct from a plain customer User while sharing identity.
 *
 * Run: node --env-file=.env scripts/eat51-smoke.mjs
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertPortAndWiring() {
  const helper = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'courier-profile.ts'),
    'utf8',
  );
  const mod = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'couriers', 'couriers.module.ts'),
    'utf8',
  );
  const appModule = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'app.module.ts'),
    'utf8',
  );
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const adr = readFileSync(
    path.join(root, 'docs', 'decisions', '0021-courier-model.md'),
    'utf8',
  );
  const migration = readFileSync(
    path.join(
      root,
      'packages',
      'database',
      'prisma',
      'migrations',
      '20261106200000_courier_model',
      'migration.sql',
    ),
    'utf8',
  );
  const architecture = readFileSync(
    path.join(root, 'docs', 'architecture', 'README.md'),
    'utf8',
  );

  assert(helper.includes('export function isCourierOnboardingComplete'), 'onboarding helper missing');
  assert(helper.includes('export function isCourierDispatchEligible'), 'dispatch helper missing');
  assert(helper.includes('export function requiresLicenseNumber'), 'license helper missing');
  assert(mod.includes('CouriersModule'), 'CouriersModule missing');
  assert(appModule.includes('CouriersModule'), 'AppModule not importing CouriersModule');
  assert(schema.includes('model CourierProfile'), 'schema missing CourierProfile');
  assert(schema.includes('enum CourierVehicleType'), 'schema missing CourierVehicleType');
  assert(schema.includes('vehicleType'), 'schema missing vehicleType');
  assert(schema.includes('operatingCityId'), 'CourierProfile missing operatingCityId');
  assert(schema.includes('submittedAt'), 'CourierProfile missing submittedAt');
  assert(migration.includes('CourierVehicleType'), 'migration missing CourierVehicleType');
  assert(adr.includes('EAT-51'), 'ADR 0021 missing EAT-51');
  assert(architecture.includes('0021-courier-model'), 'architecture README missing ADR 0021');
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
    throw new Error('EAT-51 unit tests failed');
  }
}

async function proveDistinctCourierRecord() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for EAT-51 DB acceptance proof');
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

  const customerId = randomUUID();
  const courierUserId = randomUUID();
  const citySlug = `eat51-${Date.now()}`;
  const passwordHash = await hash('SmokeTest1!');

  try {
    const city = await prisma.operatingCity.create({
      data: {
        name: 'EAT-51 Smoke City',
        country: 'PK',
        slug: citySlug,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        id: customerId,
        email: `customer.${customerId.slice(0, 8)}@eatwave.test`,
        name: 'Smoke Customer',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        id: courierUserId,
        email: `courier.${courierUserId.slice(0, 8)}@eatwave.test`,
        name: 'Smoke Courier',
        passwordHash,
        emailVerifiedAt: new Date(),
        courierProfile: {
          create: {
            status: 'PENDING',
            phone: '+923001234567',
            vehicleType: 'MOTORCYCLE',
            vehiclePlate: 'LEA-51',
            licenseNumber: 'LIC-EAT-51',
            operatingCityId: city.id,
            submittedAt: new Date(),
          },
        },
      },
    });

    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      include: { courierProfile: true },
    });
    const courier = await prisma.user.findUnique({
      where: { id: courierUserId },
      include: { courierProfile: true },
    });

    assert(customer, 'customer user missing');
    assert(customer.courierProfile == null, 'customer must not have a courier profile');
    assert(courier?.courierProfile, 'courier user missing CourierProfile');
    assert(courier.courierProfile.userId === courierUserId, 'profile must share User identity');
    assert(courier.courierProfile.vehicleType === 'MOTORCYCLE', 'vehicleType not persisted');
    assert(courier.courierProfile.phone === '+923001234567', 'phone not persisted');
    assert(
      courier.courierProfile.operatingCityId === city.id,
      'operatingCityId not persisted',
    );
  } finally {
    await prisma.courierProfile.deleteMany({ where: { userId: courierUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [customerId, courierUserId] } } }).catch(() => {});
    await prisma.operatingCity.deleteMany({ where: { slug: citySlug } }).catch(() => {});
    await prisma.$disconnect();
  }
}

assertPortAndWiring();
runTests();
await proveDistinctCourierRecord();
console.log('eat51-smoke: ok');
