/**
 * EAT-47 idempotency protection smoke.
 * Proves store/replay helpers, noop provider replay, schema, and checkout wiring.
 *
 * Run: node scripts/eat47-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertSchemaHasIdempotency() {
  const schema = readFileSync(
    path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'),
    'utf8',
  );
  assert(schema.includes('model IdempotencyRecord'), 'missing IdempotencyRecord');
  assert(schema.includes('@@unique([scope, key])'), 'missing scope+key unique');
}

function assertCheckoutWired() {
  const service = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'checkout', 'checkout.service.ts'),
    'utf8',
  );
  const controller = readFileSync(
    path.join(root, 'apps', 'api', 'src', 'checkout', 'checkout.controller.ts'),
    'utf8',
  );
  const customerCheckout = readFileSync(
    path.join(
      root,
      'apps',
      'customer-web',
      'app',
      'checkout',
      '[restaurantId]',
      'page.tsx',
    ),
    'utf8',
  );
  assert(service.includes('runWithIdempotency'), 'checkout.service missing runWithIdempotency');
  assert(
    controller.includes('idempotency-key'),
    'checkout.controller missing Idempotency-Key header',
  );
  assert(
    customerCheckout.includes('Idempotency-Key'),
    'customer checkout page missing Idempotency-Key header',
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
      'src/common/idempotency.spec.ts',
      'src/checkout/checkout-idempotency.spec.ts',
      'src/payments/payment-provider.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `idempotency tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertSchemaHasIdempotency();
assertCheckoutWired();
runTests();
console.log(
  'eat47-smoke: ok (IdempotencyRecord + checkout header + store/replay tests)',
);
