import { describe, expect, it } from 'vitest';
import { createRefundDraft } from './refund-record';

describe('refund record draft', () => {
  it('is always traceable to both payment and order', () => {
    expect(
      createRefundDraft({
        payment: {
          id: 'pay-1',
          orderId: 'ord-9',
          currency: 'USD',
        },
        amountCents: 1000,
        reason: 'requested_by_customer',
        providerRefundId: 'noop_refund_1',
        actorUserId: 'user-1',
      }),
    ).toEqual({
      paymentId: 'pay-1',
      orderId: 'ord-9',
      amountCents: 1000,
      currency: 'USD',
      status: 'SUCCEEDED',
      reason: 'requested_by_customer',
      providerRefundId: 'noop_refund_1',
      actorUserId: 'user-1',
    });
  });

  it('derives orderId from the payment — never invents a free-floating refund', () => {
    expect(() =>
      createRefundDraft({
        payment: {
          id: '',
          orderId: 'ord-9',
          currency: 'USD',
        },
        amountCents: 100,
      }),
    ).toThrow(/payment/i);

    expect(() =>
      createRefundDraft({
        payment: {
          id: 'pay-1',
          orderId: '',
          currency: 'USD',
        },
        amountCents: 100,
      }),
    ).toThrow(/order/i);
  });
});
