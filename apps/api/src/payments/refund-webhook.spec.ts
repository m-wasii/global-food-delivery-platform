import { describe, expect, it } from 'vitest';
import { planRefundWebhookApply } from './refund-webhook';

describe('planRefundWebhookApply', () => {
  it('flips a pending refund to SUCCEEDED and counts the amount on the payment', () => {
    const plan = planRefundWebhookApply({
      currentRefundStatus: 'PENDING',
      nextRefundStatus: 'SUCCEEDED',
      paymentStatus: 'CAPTURED',
      orderStatus: 'COMPLETED',
      amountReceivedCents: 2500,
      refundedAmountCents: 0,
      refundAmountCents: 1000,
    });

    expect(plan).toEqual({
      noop: false,
      refundStatus: 'SUCCEEDED',
      payment: {
        nextStatus: 'PARTIALLY_REFUNDED',
        nextRefundedAmountCents: 1000,
        statusChanged: true,
        reverseAmounts: false,
      },
    });
  });

  it('flips a succeeded refund to FAILED and reverses payment amounts', () => {
    const plan = planRefundWebhookApply({
      currentRefundStatus: 'SUCCEEDED',
      nextRefundStatus: 'FAILED',
      paymentStatus: 'PARTIALLY_REFUNDED',
      orderStatus: 'COMPLETED',
      amountReceivedCents: 2500,
      refundedAmountCents: 1000,
      refundAmountCents: 1000,
    });

    expect(plan).toEqual({
      noop: false,
      refundStatus: 'FAILED',
      payment: {
        nextStatus: 'CAPTURED',
        nextRefundedAmountCents: 0,
        statusChanged: true,
        reverseAmounts: true,
      },
    });
  });

  it('is a no-op when the refund is already at the webhook status (duplicate delivery)', () => {
    const plan = planRefundWebhookApply({
      currentRefundStatus: 'FAILED',
      nextRefundStatus: 'FAILED',
      paymentStatus: 'CAPTURED',
      orderStatus: 'COMPLETED',
      amountReceivedCents: 2500,
      refundedAmountCents: 0,
      refundAmountCents: 1000,
    });

    expect(plan).toEqual({
      noop: true,
      refundStatus: 'FAILED',
    });
  });

  it('does not reverse amounts when a pending refund fails before settlement', () => {
    const plan = planRefundWebhookApply({
      currentRefundStatus: 'PENDING',
      nextRefundStatus: 'FAILED',
      paymentStatus: 'CAPTURED',
      orderStatus: 'COMPLETED',
      amountReceivedCents: 2500,
      refundedAmountCents: 0,
      refundAmountCents: 1000,
    });

    expect(plan).toEqual({
      noop: false,
      refundStatus: 'FAILED',
    });
  });

  it('restores PARTIALLY_REFUNDED when a full-refund failure leaves another succeeded partial', () => {
    const plan = planRefundWebhookApply({
      currentRefundStatus: 'SUCCEEDED',
      nextRefundStatus: 'FAILED',
      paymentStatus: 'REFUNDED',
      orderStatus: 'COMPLETED',
      amountReceivedCents: 2500,
      refundedAmountCents: 2500,
      refundAmountCents: 1500,
    });

    expect(plan).toEqual({
      noop: false,
      refundStatus: 'FAILED',
      payment: {
        nextStatus: 'PARTIALLY_REFUNDED',
        nextRefundedAmountCents: 1000,
        statusChanged: true,
        reverseAmounts: true,
      },
    });
  });
});
