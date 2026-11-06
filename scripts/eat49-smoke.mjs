/**
 * EAT-49 fees & commission smoke.
 * Proves settlement module, order snapshot wiring, schema, and ADR 0019.
 *
 * Run: node scripts/eat49-smoke.mjs
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
  const commission = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'cart', 'commission.ts'),
    'utf8',
  );
  const orderCreation = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'orders', 'order-creation.ts'),
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
    path.join(root, 'docs', 'decisions', '0019-fees-and-commission.md'),
    'utf8',
  );
  const migration = readFileSync(
    path.join(
      root,
      'packages',
      'database',
      'prisma',
      'migrations',
      '20261106100000_order_settlement_snapshot',
      'migration.sql',
    ),
    'utf8',
  );

  assert(commission.includes('export function settleOrder'), 'settleOrder missing');
  assert(
    commission.includes('export function planSettlementClawback'),
    'planSettlementClawback missing',
  );
  assert(
    orderCreation.includes('buildSettlementSnapshot'),
    'buildSettlementSnapshot missing',
  );
  assert(ordersService.includes('buildSettlementSnapshot'), 'orders service not settling');
  assert(ordersService.includes('settlement:'), 'serializeOrder missing settlement');
  assert(schema.includes('commissionCents'), 'schema missing commissionCents');
  assert(schema.includes('platformRevenueCents'), 'schema missing platformRevenueCents');
  assert(schema.includes('restaurantNetCents'), 'schema missing restaurantNetCents');
  assert(migration.includes('commissionCents'), 'migration missing commissionCents');
  assert(adr.includes('EAT-49'), 'ADR 0019 missing EAT-49');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/cart/commission.spec.ts',
      'src/orders/order-creation.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error('EAT-49 related tests failed');
  }
}

assertPortAndWiring();
runTests();
console.log('eat49-smoke: ok');
