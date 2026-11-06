import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from './cors-origins';

describe('resolveCorsOrigins', () => {
  it('includes customer and partner web origins with defaults', () => {
    expect(resolveCorsOrigins({})).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
    ]);
  });

  it('uses env overrides and dedupes', () => {
    expect(
      resolveCorsOrigins({
        PUBLIC_WEB_URL: 'http://customer.test',
        PARTNER_WEB_URL: 'http://customer.test',
      }),
    ).toEqual(['http://customer.test']);
  });
});
