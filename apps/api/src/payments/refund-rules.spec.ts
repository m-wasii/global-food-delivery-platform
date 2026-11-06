import { describe, expect, it } from 'vitest';
import {
  planRefund,
  refundableRemainingCents,
} from './refund-rules';

describe('refund rules', () => {
  it('computes remaining refundable cents from captured vs already refunded', () => {
    expect(
      refundableRemainingCents({
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
      }),
    ).toBe(2599);
    expect(
      refundableRemainingCents({
        amountReceivedCents: 2599,
        refundedAmountCents: 1000,
      }),
    ).toBe(1599);
  });

  it('plans a partial refund and leaves payment PARTIALLY_REFUNDED', () => {
    expect(
      planRefund({
        paymentStatus: 'CAPTURED',
        orderStatus: 'COMPLETED',
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
        refundAmountCents: 1000,
      }),
    ).toEqual({
      kind: 'partial',
      nextPaymentStatus: 'PARTIALLY_REFUNDED',
      nextRefundedAmountCents: 1000,
      statusChanged: true,
    });
  });

  it('plans a full refund to REFUNDED', () => {
    expect(
      planRefund({
        paymentStatus: 'CAPTURED',
        orderStatus: 'COMPLETED',
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
        refundAmountCents: 2599,
      }),
    ).toEqual({
      kind: 'full',
      nextPaymentStatus: 'REFUNDED',
      nextRefundedAmountCents: 2599,
      statusChanged: true,
    });
  });

  it('allows a second partial that stays PARTIALLY_REFUNDED without a status edge', () => {
    expect(
      planRefund({
        paymentStatus: 'PARTIALLY_REFUNDED',
        orderStatus: 'COMPLETED',
        amountReceivedCents: 2599,
        refundedAmountCents: 1000,
        refundAmountCents: 500,
      }),
    ).toEqual({
      kind: 'partial',
      nextPaymentStatus: 'PARTIALLY_REFUNDED',
      nextRefundedAmountCents: 1500,
      statusChanged: false,
    });
  });

  it('completes the ladder from PARTIALLY_REFUNDED to REFUNDED', () => {
    expect(
      planRefund({
        paymentStatus: 'PARTIALLY_REFUNDED',
        orderStatus: 'CANCELLED',
        amountReceivedCents: 2599,
        refundedAmountCents: 1000,
        refundAmountCents: 1599,
      }),
    ).toEqual({
      kind: 'full',
      nextPaymentStatus: 'REFUNDED',
      nextRefundedAmountCents: 2599,
      statusChanged: true,
    });
  });

  it('rejects refunds that are not positive minor units', () => {
    expect(() =>
      planRefund({
        paymentStatus: 'CAPTURED',
        orderStatus: 'COMPLETED',
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
        refundAmountCents: 0,
      }),
    ).toThrow(/positive integer/);
  });

  it('rejects over-refunds beyond the captured remainder', () => {
    expect(() =>
      planRefund({
        paymentStatus: 'CAPTURED',
        orderStatus: 'COMPLETED',
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
        refundAmountCents: 2600,
      }),
    ).toThrow(/exceeds/);
  });

  it('rejects refunds before capture (cancel the auth instead)', () => {
    expect(() =>
      planRefund({
        paymentStatus: 'AUTHORIZED',
        orderStatus: 'PENDING',
        amountReceivedCents: 0,
        refundedAmountCents: 0,
        refundAmountCents: 1000,
      }),
    ).toThrow(/Cannot refund/);
  });

  it('rejects refunds that would diverge from the order money matrix', () => {
    expect(() =>
      planRefund({
        paymentStatus: 'CAPTURED',
        orderStatus: 'CONFIRMED',
        amountReceivedCents: 2599,
        refundedAmountCents: 0,
        refundAmountCents: 1000,
      }),
    ).toThrow(/diverge/);
  });
});
