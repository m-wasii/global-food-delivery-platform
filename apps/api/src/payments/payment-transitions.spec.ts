import { describe, expect, it } from 'vitest';
import {
  assertCanTransitionPayment,
  canTransitionPayment,
  allowedPaymentTargets,
} from './payment-transitions';

describe('payment transitions', () => {
  it('allows the auth → capture → refund happy path', () => {
    expect(canTransitionPayment('REQUIRES_ACTION', 'AUTHORIZED')).toBe(true);
    expect(canTransitionPayment('AUTHORIZED', 'CAPTURED')).toBe(true);
    expect(canTransitionPayment('CAPTURED', 'PARTIALLY_REFUNDED')).toBe(true);
    expect(canTransitionPayment('PARTIALLY_REFUNDED', 'REFUNDED')).toBe(true);
    expect(canTransitionPayment('CAPTURED', 'REFUNDED')).toBe(true);
  });

  it('allows cancel of an uncaptured hold and processing ladder', () => {
    expect(canTransitionPayment('AUTHORIZED', 'CANCELED')).toBe(true);
    expect(canTransitionPayment('REQUIRES_ACTION', 'PROCESSING')).toBe(true);
    expect(canTransitionPayment('PROCESSING', 'AUTHORIZED')).toBe(true);
    expect(canTransitionPayment('PROCESSING', 'FAILED')).toBe(true);
  });

  it('allows retry from FAILED and rejects terminal / invalid moves', () => {
    expect(canTransitionPayment('FAILED', 'AUTHORIZED')).toBe(true);
    expect(canTransitionPayment('FAILED', 'REQUIRES_ACTION')).toBe(true);
    expect(canTransitionPayment('CANCELED', 'AUTHORIZED')).toBe(false);
    expect(canTransitionPayment('AUTHORIZED', 'REFUNDED')).toBe(false);
    expect(canTransitionPayment('CAPTURED', 'AUTHORIZED')).toBe(false);
    expect(() => assertCanTransitionPayment('CAPTURED', 'AUTHORIZED')).toThrow(
      /Invalid payment transition/,
    );
  });

  it('allows refund-failure unwind of payment money states', () => {
    expect(canTransitionPayment('REFUNDED', 'CAPTURED')).toBe(true);
    expect(canTransitionPayment('REFUNDED', 'PARTIALLY_REFUNDED')).toBe(true);
    expect(canTransitionPayment('PARTIALLY_REFUNDED', 'CAPTURED')).toBe(true);
  });

  it('lists targets and rejects same-status edges', () => {
    expect(allowedPaymentTargets('AUTHORIZED')).toEqual(
      expect.arrayContaining(['CAPTURED', 'CANCELED', 'FAILED']),
    );
    expect(canTransitionPayment('AUTHORIZED', 'AUTHORIZED')).toBe(false);
    expect(allowedPaymentTargets('REFUNDED')).toEqual([
      'PARTIALLY_REFUNDED',
      'CAPTURED',
    ]);
  });
});
