/**
 * EAT-50 coupons & promotions smoke.
 * Proves pure engine, checkout wiring, schema, redemption path, and ADR 0020.
 *
 * Run: node scripts/eat50-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  const migration = readFileSync(
    path.join(
      root,
      'packages',
      'database',
      'prisma',
      'migrations',
      '20261106110000_promotions',
      'migration.sql',
    ),
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
  assert(migration.includes('PromotionRedemption'), 'migration missing PromotionRedemption');
  assert(adr.includes('EAT-50'), 'ADR 0020 missing EAT-50');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/promotions',
      'src/checkout/checkout-idempotency.spec.ts',
      'src/cart/pricing.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('EAT-50 related tests failed');
  }
}

assertPortAndWiring();
runTests();
console.log('eat50-smoke: ok');
