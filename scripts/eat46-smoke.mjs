/**
 * EAT-46 payment state machine smoke.
 * Proves FSM + order↔payment consistency without a live API.
 *
 * Run: node scripts/eat46-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertSchemaHasPayment() {
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  assert(schema.includes('enum PaymentStatus'), 'missing PaymentStatus enum');
  assert(schema.includes('model Payment {'), 'missing Payment model');
  assert(
    schema.includes('model PaymentStatusHistory {'),
    'missing PaymentStatusHistory',
  );
  assert(schema.includes('reconciliationNeeded'), 'missing reconciliation flag');
}

function assertOrdersGuardWired() {
  const src = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'orders', 'orders.service.ts'),
    'utf8',
  );
  assert(
    src.includes('assertOrderTransitionKeepsPaymentAligned'),
    'orders.service missing payment consistency guard',
  );
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/payments/payment-transitions.spec.ts',
      'src/payments/order-payment-consistency.spec.ts',
      'src/payments/payment-reconciliation.spec.ts',
      'src/payments/payment-provider.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `payment FSM tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertSchemaHasPayment();
assertOrdersGuardWired();
runTests();
console.log(
  'eat46-smoke: ok (Payment FSM + order consistency + provider contract)',
);
