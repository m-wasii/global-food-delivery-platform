import { describe, expect, it } from 'vitest';
import {
  InMemoryIdempotencyStore,
  IdempotencyConflictError,
  runWithIdempotency,
} from '../common/idempotency';
import {
  normalizeIdempotencyKey,
  toHttpIdempotencyError,
} from '../common/idempotency-http';
import {
  refundIssueRequest,
  refundIssueScope,
  toRefundHttpResponse,
} from './refund-http';

describe('refund HTTP helpers', () => {
  it('scopes issue by payment id', () => {
    expect(refundIssueScope('pay_1')).toBe('payments.refund:pay_1');
  });

  it('fingerprints only client-declared refund fields', () => {
    expect(
      refundIssueRequest({ amountCents: 500, reason: 'requested_by_customer' }),
    ).toEqual({
      amountCents: 500,
      reason: 'requested_by_customer',
    });
    expect(refundIssueRequest({ amountCents: 100 })).toEqual({
      amountCents: 100,
      reason: null,
    });
  });

  it('requires a non-empty Idempotency-Key', () => {
    expect(normalizeIdempotencyKey('  rf-1  ')).toBe('rf-1');
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
  });

  it('response always exposes refund linked to order and payment', () => {
    const body = toRefundHttpResponse({
      refund: {
        id: 're_1',
        paymentId: 'pay_1',
        orderId: 'ord_1',
        amountCents: 500,
        currency: 'USD',
        status: 'SUCCEEDED',
        reason: null,
        providerRefundId: 'noop:r:500',
        actorUserId: 'user_1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      payment: {
        id: 'pay_1',
        orderId: 'ord_1',
        status: 'PARTIALLY_REFUNDED',
        refundedAmountCents: 500,
        amountReceivedCents: 1000,
      },
    });

    expect(body.refund.paymentId).toBe('pay_1');
    expect(body.refund.orderId).toBe('ord_1');
    expect(body.refund.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(body.payment.id).toBe('pay_1');
    expect(body.payment.orderId).toBe('ord_1');
  });

  it('replays issue so a duplicate key does not create a second refund', async () => {
    const store = new InMemoryIdempotencyStore();
    let issues = 0;
    const run = () =>
      runWithIdempotency({
        store,
        scope: refundIssueScope('pay_1'),
        key: normalizeIdempotencyKey('refund-1'),
        request: refundIssueRequest({ amountCents: 500 }),
        execute: async () => {
          issues += 1;
          return toRefundHttpResponse({
            refund: {
              id: `re_${issues}`,
              paymentId: 'pay_1',
              orderId: 'ord_1',
              amountCents: 500,
              currency: 'USD',
              status: 'SUCCEEDED',
              reason: null,
              providerRefundId: null,
              actorUserId: null,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
            payment: {
              id: 'pay_1',
              orderId: 'ord_1',
              status: 'PARTIALLY_REFUNDED',
              refundedAmountCents: 500,
              amountReceivedCents: 1000,
            },
          });
        },
      });

    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    expect(issues).toBe(1);
  });
});
