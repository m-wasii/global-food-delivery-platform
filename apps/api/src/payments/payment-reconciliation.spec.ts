import { describe, expect, it } from 'vitest';
import {
  nextPaymentAttemptCount,
  planPaymentCreate,
  planPaymentStatusChange,
  providerDivergesFromLocal,
} from './payment-reconciliation';

describe('payment reconciliation helpers', () => {
  it('flags provider vs local status mismatch for ops review', () => {
    expect(providerDivergesFromLocal('AUTHORIZED', 'AUTHORIZED')).toBe(false);
    expect(providerDivergesFromLocal('AUTHORIZED', 'CAPTURED')).toBe(true);
    expect(providerDivergesFromLocal('CAPTURED', 'CANCELED')).toBe(true);
  });

  it('increments attemptCount only when retrying out of FAILED', () => {
    expect(nextPaymentAttemptCount('FAILED', 'AUTHORIZED', 1)).toBe(2);
    expect(nextPaymentAttemptCount('AUTHORIZED', 'CAPTURED', 1)).toBe(1);
    expect(nextPaymentAttemptCount('FAILED', 'REQUIRES_ACTION', 3)).toBe(4);
  });

  it('plans a transition only when graph and order consistency both pass', () => {
    expect(
      planPaymentStatusChange({
        from: 'AUTHORIZED',
        to: 'CAPTURED',
        orderStatus: 'CONFIRMED',
        attemptCount: 1,
      }),
    ).toEqual({ to: 'CAPTURED', attemptCount: 1 });

    expect(
      planPaymentStatusChange({
        from: 'FAILED',
        to: 'AUTHORIZED',
        orderStatus: 'PENDING',
        attemptCount: 1,
      }),
    ).toEqual({ to: 'AUTHORIZED', attemptCount: 2 });

    expect(() =>
      planPaymentStatusChange({
        from: 'AUTHORIZED',
        to: 'CAPTURED',
        orderStatus: 'PENDING',
        attemptCount: 1,
      }),
    ).toThrow(/diverge/);

    expect(() =>
      planPaymentStatusChange({
        from: 'CAPTURED',
        to: 'AUTHORIZED',
        orderStatus: 'CONFIRMED',
        attemptCount: 1,
      }),
    ).toThrow(/Invalid payment transition/);
  });

  it('rejects creating a payment that would diverge from the order', () => {
    expect(() =>
      planPaymentCreate({
        orderStatus: 'PENDING',
        paymentStatus: 'AUTHORIZED',
      }),
    ).not.toThrow();
    expect(() =>
      planPaymentCreate({
        orderStatus: 'PENDING',
        paymentStatus: 'CAPTURED',
      }),
    ).toThrow(/diverge/);
  });
});
