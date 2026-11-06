/**
 * EAT-48 refund records smoke.
 * Proves schema traceability (order + payment FKs) and refund rule tests.
 *
 * Run: node scripts/eat48-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertSchemaHasRefund() {
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  assert(schema.includes('enum RefundStatus'), 'missing RefundStatus enum');
  assert(schema.includes('model Refund {'), 'missing Refund model');
  assert(schema.includes('paymentId'), 'Refund missing paymentId');
  assert(
    /model Refund \{[\s\S]*?orderId\s+String/.test(schema),
    'Refund missing orderId',
  );
  assert(
    schema.includes('references: [id]') &&
      schema.includes('fields: [paymentId]') &&
      schema.includes('fields: [orderId]'),
    'Refund missing payment/order FKs',
  );
}

function assertServiceWired() {
  const service = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'refunds.service.ts'),
    'utf8',
  );
  const mod = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'payments.module.ts'),
    'utf8',
  );
  assert(service.includes('planRefund'), 'RefundsService missing planRefund');
  assert(
    service.includes('createRefundDraft'),
    'RefundsService missing createRefundDraft',
  );
  assert(
    service.includes('listForOrder') && service.includes('listForPayment'),
    'RefundsService missing list helpers',
  );
  assert(mod.includes('RefundsService'), 'PaymentsModule missing RefundsService');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/payments/refund-rules.spec.ts',
      'src/payments/refund-record.spec.ts',
      'src/payments/payment-transitions.spec.ts',
      'src/payments/order-payment-consistency.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `refund tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertSchemaHasRefund();
assertServiceWired();
runTests();
console.log(
  'eat48-smoke: ok (Refund model + order/payment FKs + refund rules)',
);
