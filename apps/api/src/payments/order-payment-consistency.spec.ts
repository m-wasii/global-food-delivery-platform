import { describe, expect, it } from 'vitest';
import {
  assertOrderPaymentConsistent,
  assertOrderTransitionKeepsPaymentAligned,
  isOrderPaymentConsistent,
} from './order-payment-consistency';

describe('order ↔ payment consistency', () => {
  it('allows hold while order is pending and capture once kitchen commits', () => {
    expect(isOrderPaymentConsistent('PENDING', 'AUTHORIZED')).toBe(true);
    expect(isOrderPaymentConsistent('PENDING', 'REQUIRES_ACTION')).toBe(true);
    expect(isOrderPaymentConsistent('PENDING', 'PROCESSING')).toBe(true);
    expect(isOrderPaymentConsistent('CONFIRMED', 'CAPTURED')).toBe(true);
    expect(isOrderPaymentConsistent('PREPARING', 'CAPTURED')).toBe(true);
    expect(isOrderPaymentConsistent('READY', 'CAPTURED')).toBe(true);
  });

  it('allows completed with capture or refund ladder; reject/cancel with void or fail', () => {
    expect(isOrderPaymentConsistent('COMPLETED', 'CAPTURED')).toBe(true);
    expect(isOrderPaymentConsistent('COMPLETED', 'PARTIALLY_REFUNDED')).toBe(
      true,
    );
    expect(isOrderPaymentConsistent('COMPLETED', 'REFUNDED')).toBe(true);
    expect(isOrderPaymentConsistent('CANCELLED', 'CANCELED')).toBe(true);
    expect(isOrderPaymentConsistent('CANCELLED', 'REFUNDED')).toBe(true);
    expect(isOrderPaymentConsistent('CANCELLED', 'FAILED')).toBe(true);
    expect(isOrderPaymentConsistent('REJECTED', 'CANCELED')).toBe(true);
    expect(isOrderPaymentConsistent('REJECTED', 'FAILED')).toBe(true);
  });

  it('rejects silent divergence (e.g. confirmed without capture)', () => {
    expect(isOrderPaymentConsistent('CONFIRMED', 'AUTHORIZED')).toBe(false);
    expect(isOrderPaymentConsistent('PENDING', 'CAPTURED')).toBe(false);
    expect(isOrderPaymentConsistent('REJECTED', 'CAPTURED')).toBe(false);
    expect(isOrderPaymentConsistent('PREPARING', 'CANCELED')).toBe(false);
    expect(() =>
      assertOrderPaymentConsistent('CONFIRMED', 'AUTHORIZED'),
    ).toThrow(/Order and payment state diverge/);
  });

  it('skips the guard when no payment exists yet; blocks confirm without capture', () => {
    expect(() =>
      assertOrderTransitionKeepsPaymentAligned('CONFIRMED', null),
    ).not.toThrow();
    expect(() =>
      assertOrderTransitionKeepsPaymentAligned('CONFIRMED', 'AUTHORIZED'),
    ).toThrow(/diverge/);
  });
});
