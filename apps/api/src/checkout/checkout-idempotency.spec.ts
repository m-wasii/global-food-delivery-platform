import { describe, expect, it } from 'vitest';
import {
  InMemoryIdempotencyStore,
  runWithIdempotency,
} from '../common/idempotency';
import {
  checkoutConfirmRequest,
  checkoutConfirmScope,
  normalizeIdempotencyKey,
  toHttpIdempotencyError,
} from './checkout-idempotency';
import { IdempotencyConflictError } from '../common/idempotency';

describe('checkout idempotency helpers', () => {
  it('scopes confirm by user and restaurant', () => {
    expect(checkoutConfirmScope('user-1', 'rest-9')).toBe(
      'checkout.confirm:user-1:rest-9',
    );
  });

  it('fingerprints only the client-declared confirm fields', () => {
    expect(
      checkoutConfirmRequest({
        fulfillment: 'DELIVERY',
        deliveryAddressId: 'addr-1',
        discoveryAddressId: 'addr-1',
        promoCode: 'save10',
      }),
    ).toEqual({
      fulfillment: 'DELIVERY',
      deliveryAddressId: 'addr-1',
      discoveryAddressId: 'addr-1',
      promoCode: 'SAVE10',
    });
  });

  it('requires a non-empty Idempotency-Key', () => {
    expect(normalizeIdempotencyKey('  ck-1  ')).toBe('ck-1');
    expect(() => normalizeIdempotencyKey(undefined)).toThrow(
      /idempotency-key/i,
    );
    expect(() => normalizeIdempotencyKey('')).toThrow(/idempotency-key/i);
  });

  it('maps conflicts to HTTP 409 payloads', () => {
    const mismatch = toHttpIdempotencyError(
      new IdempotencyConflictError('request_mismatch'),
    );
    expect(mismatch.getStatus()).toBe(409);
    expect(mismatch.message).toMatch(/different request parameters/i);

    const inUse = toHttpIdempotencyError(
      new IdempotencyConflictError('in_progress'),
    );
    expect(inUse.getStatus()).toBe(409);
  });

  it('replays confirm so a duplicate key does not create a second order', async () => {
    const store = new InMemoryIdempotencyStore();
    let creates = 0;
    const run = () =>
      runWithIdempotency({
        store,
        scope: checkoutConfirmScope('user-1', 'rest-1'),
        key: normalizeIdempotencyKey('checkout-1'),
        request: checkoutConfirmRequest({ fulfillment: 'PICKUP' }),
        execute: async () => {
          creates += 1;
          return { order: { id: `order_${creates}` }, pricing: { totalCents: 100 } };
        },
      });

    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    expect(creates).toBe(1);
  });
});
