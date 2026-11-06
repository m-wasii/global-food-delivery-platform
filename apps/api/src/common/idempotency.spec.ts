import { describe, expect, it } from 'vitest';
import {
  decideIdempotency,
  hashIdempotencyRequest,
  InMemoryIdempotencyStore,
  IdempotencyConflictError,
  runWithIdempotency,
} from './idempotency';

describe('hashIdempotencyRequest', () => {
  it('is stable for the same logical payload regardless of key order', () => {
    const a = hashIdempotencyRequest({ amountCents: 1000, currency: 'USD' });
    const b = hashIdempotencyRequest({ currency: 'USD', amountCents: 1000 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs when a field changes', () => {
    const a = hashIdempotencyRequest({ amountCents: 1000, currency: 'USD' });
    const b = hashIdempotencyRequest({ amountCents: 1001, currency: 'USD' });
    expect(a).not.toBe(b);
  });
});

describe('decideIdempotency', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  const requestHash = hashIdempotencyRequest({ amountCents: 1000 });

  it('executes when no prior record exists', () => {
    expect(
      decideIdempotency({ existing: null, requestHash, now }),
    ).toEqual({ action: 'execute' });
  });

  it('replays the stored response when the request hash matches', () => {
    expect(
      decideIdempotency({
        existing: {
          requestHash,
          responseJson: '{"ok":true}',
          expiresAt: new Date('2026-11-07T12:00:00.000Z'),
        },
        requestHash,
        now,
      }),
    ).toEqual({ action: 'replay', responseJson: '{"ok":true}' });
  });

  it('conflicts when the same key is reused with different parameters', () => {
    expect(
      decideIdempotency({
        existing: {
          requestHash,
          responseJson: '{"ok":true}',
          expiresAt: new Date('2026-11-07T12:00:00.000Z'),
        },
        requestHash: hashIdempotencyRequest({ amountCents: 2000 }),
        now,
      }),
    ).toEqual({ action: 'conflict', reason: 'request_mismatch' });
  });

  it('conflicts when a prior attempt is still in progress', () => {
    expect(
      decideIdempotency({
        existing: {
          requestHash,
          responseJson: null,
          expiresAt: new Date('2026-11-07T12:00:00.000Z'),
        },
        requestHash,
        now,
      }),
    ).toEqual({ action: 'conflict', reason: 'in_progress' });
  });

  it('executes again after the prior record expires', () => {
    expect(
      decideIdempotency({
        existing: {
          requestHash,
          responseJson: '{"ok":true}',
          expiresAt: new Date('2026-11-05T12:00:00.000Z'),
        },
        requestHash,
        now,
      }),
    ).toEqual({ action: 'execute' });
  });
});

describe('runWithIdempotency', () => {
  it('executes once and replays the same result for a matching retry', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const run = () =>
      runWithIdempotency({
        store,
        scope: 'payment.authorize',
        key: 'auth-1',
        request: { amountCents: 2599, currency: 'USD' },
        execute: async () => {
          calls += 1;
          return { providerPaymentId: `pay_${calls}`, status: 'AUTHORIZED' };
        },
      });

    const first = await run();
    const second = await run();
    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });

  it('rejects when the same key is reused with different parameters', async () => {
    const store = new InMemoryIdempotencyStore();
    await runWithIdempotency({
      store,
      scope: 'payment.authorize',
      key: 'auth-1',
      request: { amountCents: 2599 },
      execute: async () => ({ ok: true }),
    });

    await expect(
      runWithIdempotency({
        store,
        scope: 'payment.authorize',
        key: 'auth-1',
        request: { amountCents: 100 },
        execute: async () => ({ ok: false }),
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});
