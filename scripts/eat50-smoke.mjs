/**
 * EAT-50 coupons & promotions smoke against a running API + DB.
 * Prerequisite: API on :3001 with DATABASE_URL; promotions migration applied.
 *
 * Run: node --env-file=.env scripts/eat50-smoke.mjs
 *
 * Covers: invalid promo rejected; overused promo rejected; valid promo discounts.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const restaurantId = 'c1111111-1111-4111-8111-111111111111';
const branchA = 'd1111111-1111-4111-8111-111111111111';
const PASSWORD = 'SmokeTest1!';

const PROMO_VALID = 'ba111111-1111-4111-8111-111111111111';
const PROMO_EXHAUSTED = 'ba222222-2222-4222-8222-222222222222';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertPortAndWiring() {
  const promotion = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'promotions', 'promotion.ts'),
    'utf8',
  );
  const redeem = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'promotions', 'promotion-redeem.ts'),
    'utf8',
  );
  const checkoutService = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'checkout', 'checkout.service.ts'),
    'utf8',
  );
  const checkoutDto = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'checkout', 'dto', 'checkout.dto.ts'),
    'utf8',
  );
  const ordersService = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'orders', 'orders.service.ts'),
    'utf8',
  );
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const adr = readFileSync(
    path.join(root, 'docs', 'decisions', '0020-coupons-and-promotions.md'),
    'utf8',
  );

  assert(promotion.includes('export function evaluatePromotion'), 'evaluatePromotion missing');
  assert(
    promotion.includes('export function calculatePromotionDiscount'),
    'calculatePromotionDiscount missing',
  );
  assert(redeem.includes('export async function redeemPromotionInTx'), 'redeem missing');
  assert(checkoutDto.includes('promoCode'), 'checkout DTO missing promoCode');
  assert(
    checkoutService.includes('resolveCheckoutPromotion'),
    'checkout not resolving promotions',
  );
  assert(ordersService.includes('redeemPromotionInTx'), 'orders not redeeming promotions');
  assert(schema.includes('model Promotion'), 'schema missing Promotion');
  assert(schema.includes('model PromotionRedemption'), 'schema missing PromotionRedemption');
  assert(adr.includes('EAT-50'), 'ADR 0020 missing EAT-50');
}

function runUnitTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/promotions',
      'src/checkout/checkout-idempotency.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('EAT-50 unit tests failed');
  }
}

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

function makeClient() {
  const jar = { value: '' };
  async function api(method, pathname, body, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
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

async function ensureOrderableAndPromos() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
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

    await prisma.promotion.upsert({
      where: { id: PROMO_VALID },
      create: {
        id: PROMO_VALID,
        code: 'EAT50SAVE10',
        active: true,
        discountType: 'PERCENT_OFF',
        percentOffBps: 1000,
        maxRedemptions: 100,
        redeemedCount: 0,
      },
      update: {
        code: 'EAT50SAVE10',
        active: true,
        discountType: 'PERCENT_OFF',
        percentOffBps: 1000,
        maxRedemptions: 100,
        redeemedCount: 0,
        maxRedemptionsPerUser: null,
        endsAt: null,
      },
    });

    await prisma.promotion.upsert({
      where: { id: PROMO_EXHAUSTED },
      create: {
        id: PROMO_EXHAUSTED,
        code: 'EAT50USEDUP',
        active: true,
        discountType: 'AMOUNT_OFF',
        amountOffCents: 200,
        currency: 'USD',
        maxRedemptions: 1,
        redeemedCount: 1,
      },
      update: {
        code: 'EAT50USEDUP',
        active: true,
        discountType: 'AMOUNT_OFF',
        amountOffCents: 200,
        currency: 'USD',
        maxRedemptions: 1,
        redeemedCount: 1,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function prepareCart(owner, customer) {
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

  const menu = await owner.api('POST', `/restaurants/${restaurantId}/menus`, {
    name: 'EAT50 Menu',
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

  const item = await owner.api(
    'POST',
    `/restaurants/${restaurantId}/menus/${menuId}/categories/${category.json.id}/items`,
    { name: 'Smoke Burger', priceCents: 1000, currency: 'USD', isAvailable: true },
  );
  assert(
    item.status === 200 || item.status === 201,
    `create item failed: ${item.status} ${JSON.stringify(item.json)}`,
  );

  const offer = await owner.api(
    'PUT',
    `/restaurants/${restaurantId}/branches/${branchA}/menu-items/${item.json.id}/availability`,
    { isAvailable: true },
  );
  assert(
    offer.status === 200 || offer.status === 201,
    `branch stock failed: ${offer.status} ${JSON.stringify(offer.json)}`,
  );

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
  await customer.api('PATCH', `/addresses/${address.json.id}/default`);

  const prefer = await customer.api(
    'PUT',
    `/restaurants/${restaurantId}/preferred-branch`,
    { branchId: branchA },
  );
  assert(
    prefer.status === 200 || prefer.status === 201,
    `preferred branch failed: ${prefer.status} ${JSON.stringify(prefer.json)}`,
  );

  await customer.api('DELETE', `/carts/${restaurantId}`);
  const add = await customer.api('POST', `/carts/${restaurantId}/items`, {
    menuItemId: item.json.id,
    quantity: 2,
  });
  assert(
    add.status === 200 || add.status === 201,
    `add to cart failed: ${add.status} ${JSON.stringify(add.json)}`,
  );

  return { deliveryAddressId: address.json.id };
}

async function liveApiSmoke() {
  const health = await fetch(`${base}/health`);
  assert(health.ok, `API health failed: ${health.status}`);

  reseed();
  await ensureOrderableAndPromos();

  const owner = makeClient();
  await login(owner.api, 'owner.smoke@eatwave.test');

  const customer = makeClient();
  await login(customer.api, 'customer.smoke@eatwave.test');

  const { deliveryAddressId } = await prepareCart(owner, customer);

  const invalid = await customer.api(
    'POST',
    `/carts/${restaurantId}/checkout/preview`,
    {
      fulfillment: 'PICKUP',
      promoCode: 'NOTAREALCODE',
    },
  );
  assert(
    invalid.status === 400,
    `invalid promo should 400, got ${invalid.status} ${JSON.stringify(invalid.json)}`,
  );
  console.log('REJECT invalid promo ok');

  const exhausted = await customer.api(
    'POST',
    `/carts/${restaurantId}/checkout/preview`,
    {
      fulfillment: 'PICKUP',
      promoCode: 'eat50usedup',
    },
  );
  assert(
    exhausted.status === 400,
    `exhausted promo should 400, got ${exhausted.status} ${JSON.stringify(exhausted.json)}`,
  );
  console.log('REJECT overused promo ok');

  const valid = await customer.api(
    'POST',
    `/carts/${restaurantId}/checkout/preview`,
    {
      fulfillment: 'PICKUP',
      promoCode: 'eat50save10',
    },
  );
  assert(
    valid.status === 200 || valid.status === 201,
    `valid promo preview failed: ${valid.status} ${JSON.stringify(valid.json)}`,
  );
  assert(valid.json?.promoCode === 'EAT50SAVE10', 'promoCode not echoed');
  assert(valid.json?.pricing?.discount === 200, `expected discount 200, got ${valid.json?.pricing?.discount}`);
  console.log(`ACCEPT valid promo ok (discount=${valid.json.pricing.discount})`);

  const confirm = await customer.api(
    'POST',
    `/carts/${restaurantId}/checkout`,
    {
      fulfillment: 'DELIVERY',
      deliveryAddressId,
      discoveryAddressId: deliveryAddressId,
      promoCode: 'EAT50SAVE10',
    },
    { 'Idempotency-Key': `eat50-smoke-${Date.now()}` },
  );
  assert(
    confirm.status === 200 || confirm.status === 201,
    `confirm with promo failed: ${confirm.status} ${JSON.stringify(confirm.json)}`,
  );
  assert(
    confirm.json?.pricing?.discount === 200,
    `confirm discount expected 200, got ${confirm.json?.pricing?.discount}`,
  );
  console.log(`CONFIRM redeem ok (order=${confirm.json?.order?.id})`);
}

assertPortAndWiring();
runUnitTests();
await liveApiSmoke();
console.log('eat50-smoke: ok');
