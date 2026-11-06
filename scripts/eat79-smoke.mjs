/**
 * EAT-79 refund HTTP API smoke.
 * Proves controller wiring, required Idempotency-Key helpers, and refund HTTP tests.
 *
 * Run: node scripts/eat79-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertControllerWired() {
  const controller = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'refunds.controller.ts'),
    'utf8',
  );
  const service = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'refunds.service.ts'),
    'utf8',
  );
  const mod = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'payments.module.ts'),
    'utf8',
  );
  assert(
    controller.includes("Controller('payments/:paymentId/refunds')"),
    'RefundsController missing route',
  );
  assert(
    controller.includes('idempotency-key'),
    'RefundsController missing Idempotency-Key header',
  );
  assert(
    controller.includes('SessionAuthGuard'),
    'RefundsController missing SessionAuthGuard',
  );
  assert(service.includes('runWithIdempotency'), 'RefundsService missing store/replay');
  assert(
    service.includes('toRefundHttpResponse'),
    'RefundsService missing HTTP response mapper',
  );
  assert(mod.includes('RefundsController'), 'PaymentsModule missing RefundsController');
  assert(mod.includes('IDEMPOTENCY_STORE'), 'PaymentsModule missing IDEMPOTENCY_STORE');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/payments/refund-http.spec.ts',
      'src/payments/refund-rules.spec.ts',
      'src/payments/refund-record.spec.ts',
      'src/checkout/checkout-idempotency.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `refund HTTP tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertControllerWired();
runTests();
console.log(
  'eat79-smoke: ok (POST /payments/:paymentId/refunds + Idempotency-Key + tests)',
);
