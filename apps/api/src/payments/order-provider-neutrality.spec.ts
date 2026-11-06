import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const VENDOR_MARKERS = [
  'stripe',
  'adyen',
  'braintree',
  'paypal',
  '@stripe',
  'SquareClient',
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('order/checkout provider neutrality', () => {
  it('does not hard-code a payment vendor in checkout or orders modules', () => {
    const roots = [
      join(__dirname, '..', 'checkout'),
      join(__dirname, '..', 'orders'),
    ];
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const text = readFileSync(file, 'utf8').toLowerCase();
        for (const marker of VENDOR_MARKERS) {
          if (text.includes(marker.toLowerCase())) {
            hits.push(`${file} → ${marker}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
