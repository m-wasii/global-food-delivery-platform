/**
 * EAT-43 availability controls smoke against a running API + seeded DB.
 * Prerequisite: API on :3001 with DATABASE_URL.
 * Run: node --env-file=.env scripts/eat43-smoke.mjs
 *
 * Covers: owner pause → customer discovery closed; item OOS → cart rejects;
 * STAFF pause blocked.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PrismaClient } = require(
  require.resolve('@prisma/client', { paths: [path.join(root, 'packages/database')] }),
);
const { PrismaPg } = require(
  require.resolve('@prisma/adapter-pg', { paths: [path.join(root, 'packages/database')] }),
);
const { hash } = require(
  require.resolve('@node-rs/argon2', { paths: [path.join(root, 'apps/api')] }),
);

const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const restaurantId = 'c1111111-1111-4111-8111-111111111111';
const branchA = 'd1111111-1111-4111-8111-111111111111';
const staffId = 'a2222222-2222-4222-8222-222222222222';
const staffMembershipId = 'f2222222-2222-4222-8222-222222222222';
const PASSWORD = 'SmokeTest1!';

function reseed() {
  const result = spawnSync(
    process.execPath,
    ['--env-file=.env', 'scripts/eat39-smoke-seed.mjs'],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`reseed failed: ${result.stderr || result.stdout}`);
  }
}

async function ensureStaffAndGeo() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const passwordHash = await hash(PASSWORD);
    await prisma.user.upsert({
      where: { id: staffId },
      create: {
        id: staffId,
        email: 'staff.smoke@eatwave.test',
        name: 'Smoke Staff',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      update: {
        email: 'staff.smoke@eatwave.test',
        name: 'Smoke Staff',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.restaurantMembership.upsert({
      where: {
        userId_restaurantId: { userId: staffId, restaurantId },
      },
      create: {
        id: staffMembershipId,
        userId: staffId,
        restaurantId,
        role: 'STAFF',
        status: 'ACTIVE',
      },
      update: { role: 'STAFF', status: 'ACTIVE' },
    });

    // Own the smoke-kitchen slug and make Branch A structurally orderable for discovery.
    await prisma.restaurant.updateMany({
      where: { slug: 'smoke-kitchen', NOT: { id: restaurantId } },
      data: { slug: `smoke-kitchen-other-${Date.now()}` },
    });
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { slug: 'smoke-kitchen', status: 'ACTIVE' },
    });
    await prisma.restaurantBranch.update({
      where: { id: branchA },
      data: {
        latitude: 31.52,
        longitude: 74.35,
        deliveryRadiusKm: 10,
        temporarilyClosed: false,
        status: 'ACTIVE',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function makeClient() {
  const jar = { value: '' };
  async function api(method, pathname, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (jar.value) headers.Cookie = jar.value;
    const res = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(';')[0];
      if (pair.startsWith('session=')) jar.value = pair;
    }
    if (!jar.value) {
      const single = res.headers.get('set-cookie');
      if (single?.startsWith('session=')) jar.value = single.split(';')[0];
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }
  return { api };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(api, email) {
  const res = await api('POST', '/auth/login', {
    email,
    password: PASSWORD,
    rememberMe: true,
  });
  assert(
    res.status === 200 || res.status === 201,
    `login ${email} failed: ${res.status} ${JSON.stringify(res.json)}`,
  );
}

async function main() {
  reseed();
  await ensureStaffAndGeo();

  const owner = makeClient();
  await login(owner.api, 'owner.smoke@eatwave.test');
  console.log('LOGIN owner ok');

  const hours = await owner.api(
    'PUT',
    `/restaurants/${restaurantId}/branches/${branchA}/weekly-hours`,
    {
      hours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTimeMinutes: 0,
        closeTimeMinutes: 1439,
        isClosed: false,
      })),
    },
  );
  assert(
    hours.status === 200 || hours.status === 201,
    `weekly hours failed: ${hours.status} ${JSON.stringify(hours.json)}`,
  );
  console.log('HOURS ok');

  const menu = await owner.api('POST', `/restaurants/${restaurantId}/menus`, {
    name: 'Smoke Menu',
    isActive: true,
  });
  assert(
    menu.status === 200 || menu.status === 201,
    `create menu failed: ${menu.status} ${JSON.stringify(menu.json)}`,
  );
  const menuId = menu.json.id;

  const category = await owner.api(
    'POST',
    `/restaurants/${restaurantId}/menus/${menuId}/categories`,
    { name: 'Mains', sortOrder: 0 },
  );
  assert(
    category.status === 200 || category.status === 201,
    `create category failed: ${category.status} ${JSON.stringify(category.json)}`,
  );
  const categoryId = category.json.id;

  const item = await owner.api(
    'POST',
    `/restaurants/${restaurantId}/menus/${menuId}/categories/${categoryId}/items`,
    { name: 'Smoke Burger', priceCents: 1500, currency: 'PKR', isAvailable: true },
  );
  assert(
    item.status === 200 || item.status === 201,
    `create item failed: ${item.status} ${JSON.stringify(item.json)}`,
  );
  const menuItemId = item.json.id;
  console.log('MENU ok');

  const offer = await owner.api(
    'PUT',
    `/restaurants/${restaurantId}/branches/${branchA}/menu-items/${menuItemId}/availability`,
    { isAvailable: true },
  );
  assert(
    offer.status === 200 || offer.status === 201,
    `offer failed: ${offer.status} ${JSON.stringify(offer.json)}`,
  );
  console.log('STOCK in ok');

  const availOpen = await owner.api(
    'GET',
    `/restaurants/${restaurantId}/branches/${branchA}/availability`,
  );
  assert(availOpen.status === 200, `availability get failed: ${availOpen.status}`);
  assert(availOpen.json.temporarilyClosed === false, 'expected not paused');
  assert(availOpen.json.now?.isOpen === true, `expected open, got ${JSON.stringify(availOpen.json.now)}`);

  const detailOpen = await owner.api('GET', '/discovery/restaurants/smoke-kitchen');
  assert(detailOpen.status === 200, `discovery detail failed: ${detailOpen.status}`);
  assert(detailOpen.json.restaurant?.id === restaurantId, 'discovery slug maps to wrong restaurant');
  const openHours = (detailOpen.json.hours ?? []).find((h) => h.branchId === branchA);
  assert(openHours?.isOpen === true, `expected discovery open, got ${JSON.stringify(openHours)}`);
  assert(detailOpen.json.isAcceptingOrders === true, 'expected accepting orders before pause');
  console.log('AVAIL open ok');

  const pause = await owner.api(
    'PATCH',
    `/restaurants/${restaurantId}/branches/${branchA}`,
    { temporarilyClosed: true },
  );
  assert(
    pause.status === 200 || pause.status === 201,
    `pause failed: ${pause.status} ${JSON.stringify(pause.json)}`,
  );

  const availPaused = await owner.api(
    'GET',
    `/restaurants/${restaurantId}/branches/${branchA}/availability`,
  );
  assert(availPaused.json.temporarilyClosed === true, 'expected paused');
  assert(
    availPaused.json.now?.reason === 'temporarily_closed',
    `expected temporarily_closed, got ${JSON.stringify(availPaused.json.now)}`,
  );

  // Paused branches are excluded from orderable discovery (temporarilyClosed filter).
  const detailPaused = await owner.api('GET', '/discovery/restaurants/smoke-kitchen');
  assert(detailPaused.status === 200, `discovery detail after pause failed: ${detailPaused.status}`);
  const pausedHours = (detailPaused.json.hours ?? []).find((h) => h.branchId === branchA);
  assert(!pausedHours, 'paused branch should drop out of discovery orderable hours');
  assert(
    detailPaused.json.isAcceptingOrders === false,
    'customers should not see restaurant as accepting orders while paused',
  );
  console.log('PAUSE → customer discovery closed ok');

  const resume = await owner.api(
    'PATCH',
    `/restaurants/${restaurantId}/branches/${branchA}`,
    { temporarilyClosed: false },
  );
  assert(
    resume.status === 200 || resume.status === 201,
    `resume failed: ${resume.status} ${JSON.stringify(resume.json)}`,
  );
  console.log('RESUME ok');

  const customer = makeClient();
  await login(customer.api, 'customer.smoke@eatwave.test');
  console.log('LOGIN customer ok');

  const address = await customer.api('POST', '/addresses', {
    label: 'Home',
    line1: '1 Smoke St',
    city: 'Lahore',
    region: 'Punjab',
    postalCode: '54000',
    country: 'PK',
    latitude: 31.52,
    longitude: 74.35,
  });
  assert(
    address.status === 200 || address.status === 201,
    `create address failed: ${address.status} ${JSON.stringify(address.json)}`,
  );
  const setDefault = await customer.api('PATCH', `/addresses/${address.json.id}/default`);
  assert(
    setDefault.status === 200 || setDefault.status === 201,
    `set default address failed: ${setDefault.status} ${JSON.stringify(setDefault.json)}`,
  );

  const prefer = await customer.api(
    'PUT',
    `/restaurants/${restaurantId}/preferred-branch`,
    { branchId: branchA },
  );
  assert(
    prefer.status === 200 || prefer.status === 201,
    `preferred branch failed: ${prefer.status} ${JSON.stringify(prefer.json)}`,
  );

  const addOk = await customer.api('POST', `/carts/${restaurantId}/items`, {
    menuItemId,
    quantity: 1,
  });
  assert(
    addOk.status === 200 || addOk.status === 201,
    `add while in stock failed: ${addOk.status} ${JSON.stringify(addOk.json)}`,
  );
  console.log('CART add in-stock ok');

  const oos = await owner.api(
    'PUT',
    `/restaurants/${restaurantId}/branches/${branchA}/menu-items/${menuItemId}/availability`,
    { isAvailable: false },
  );
  assert(
    oos.status === 200 || oos.status === 201,
    `mark OOS failed: ${oos.status} ${JSON.stringify(oos.json)}`,
  );

  await customer.api('DELETE', `/carts/${restaurantId}`);
  const addOos = await customer.api('POST', `/carts/${restaurantId}/items`, {
    menuItemId,
    quantity: 1,
  });
  assert(
    addOos.status >= 400,
    `OOS add should fail, got ${addOos.status} ${JSON.stringify(addOos.json)}`,
  );
  console.log(`CART reject OOS ok (${addOos.status})`);

  const staff = makeClient();
  await login(staff.api, 'staff.smoke@eatwave.test');
  const staffPause = await staff.api(
    'PATCH',
    `/restaurants/${restaurantId}/branches/${branchA}`,
    { temporarilyClosed: true },
  );
  assert(
    staffPause.status === 403 || staffPause.status === 401,
    `STAFF pause should be forbidden, got ${staffPause.status} ${JSON.stringify(staffPause.json)}`,
  );
  console.log(`STAFF pause blocked (${staffPause.status})`);

  console.log('SMOKE_EAT43_PASS');
  console.log(
    JSON.stringify(
      {
        hoursUrl: `http://localhost:3002/r/${restaurantId}/b/${branchA}/hours`,
        ownerEmail: 'owner.smoke@eatwave.test',
        staffEmail: 'staff.smoke@eatwave.test',
        password: PASSWORD,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
