/**
 * EAT-80 refund webhook smoke.
 * Proves parseWebhook + settlement plan + webhook ingress wiring.
 *
 * Run: node scripts/eat80-smoke.mjs
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
  const provider = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'payment-provider.ts'),
    'utf8',
  );
  const noop = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'noop-payment.provider.ts'),
    'utf8',
  );
  const service = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'refunds.service.ts'),
    'utf8',
  );
  const controller = readFileSync(
    path.join(
      root,
      'apps',
      'api',
      'src',
      'payments',
      'payment-webhooks.controller.ts',
    ),
    'utf8',
  );
  const mod = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'payments', 'payments.module.ts'),
    'utf8',
  );
  const adr = readFileSync(
    path.join(root, 'docs', 'decisions', '0018-refund-webhooks.md'),
    'utf8',
  );

  assert(provider.includes('parseWebhook'), 'PaymentProvider missing parseWebhook');
  assert(noop.includes('parseWebhook'), 'NoopPaymentProvider missing parseWebhook');
  assert(
    service.includes('applyProviderWebhook'),
    'RefundsService missing applyProviderWebhook',
  );
  assert(
    service.includes('planRefundWebhookApply'),
    'RefundsService missing planRefundWebhookApply',
  );
  assert(
    controller.includes("Controller('payments/webhooks')"),
    'PaymentWebhooksController missing route',
  );
  assert(
    mod.includes('PaymentWebhooksController'),
    'PaymentsModule missing PaymentWebhooksController',
  );
  assert(adr.includes('EAT-80'), 'ADR 0018 missing EAT-80');
}

function runTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/payments/refund-webhook.spec.ts',
      'src/payments/refund-webhook-parse.spec.ts',
      'src/payments/payment-transitions.spec.ts',
      'src/payments/payment-provider.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `refund webhook tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertPortAndWiring();
runTests();
console.log(
  'eat80-smoke: ok (parseWebhook + refund settlement + POST /payments/webhooks)',
);
