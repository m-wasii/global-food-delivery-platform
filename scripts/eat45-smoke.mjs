/**
 * EAT-45 payment abstraction smoke.
 * No running API required — proves the provider contract and that
 * checkout/orders stay free of vendor SDKs.
 *
 * Run: node scripts/eat45-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiSrc = path.join(root, 'apps', 'api', 'src');

const VENDOR_MARKERS = [
  'stripe',
  'adyen',
  'braintree',
  'paypal',
  '@stripe',
  'SquareClient',
];

function collectTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertNoVendorHardcodes() {
  const hits = [];
  for (const folder of ['checkout', 'orders']) {
    for (const file of collectTsFiles(path.join(apiSrc, folder))) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const marker of VENDOR_MARKERS) {
        if (text.includes(marker.toLowerCase())) {
          hits.push(`${path.relative(root, file)} → ${marker}`);
        }
      }
    }
  }
  assert(hits.length === 0, `vendor hardcodes: ${hits.join('; ')}`);
}

function runContractTests() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@food-delivery/api',
      'test',
      '--',
      'src/payments/payment-provider.spec.ts',
      'src/payments/order-provider-neutrality.spec.ts',
    ],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `payment contract tests failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

assertNoVendorHardcodes();
runContractTests();
console.log('eat45-smoke: ok (PaymentProvider contract + order neutrality)');
