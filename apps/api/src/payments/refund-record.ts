export const REFUND_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type RefundStatusValue = (typeof REFUND_STATUSES)[number];

export interface RefundDraftInput {
  payment: {
    id: string;
    orderId: string;
    currency: string;
  };
  amountCents: number;
  reason?: string;
  providerRefundId?: string | null;
  actorUserId?: string;
  /** Defaults to SUCCEEDED for sync provider replies (noop / immediate PSPs). */
  status?: RefundStatusValue;
}

export interface RefundDraft {
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: RefundStatusValue;
  reason: string | null;
  providerRefundId: string | null;
  actorUserId: string | null;
}

/**
 * Builds a persistable refund row that is always linked to payment + order
 * (Stripe Refund ↔ PaymentIntent / charge; EAT-48 acceptance).
 */
export function createRefundDraft(input: RefundDraftInput): RefundDraft {
  if (typeof input.payment.id !== 'string' || input.payment.id.length === 0) {
    throw new Error('Refund requires a payment id');
  }
  if (
    typeof input.payment.orderId !== 'string' ||
    input.payment.orderId.length === 0
  ) {
    throw new Error('Refund requires an order id');
  }
  return {
    paymentId: input.payment.id,
    orderId: input.payment.orderId,
    amountCents: input.amountCents,
    currency: input.payment.currency,
    status: input.status ?? 'SUCCEEDED',
    reason: input.reason ?? null,
    providerRefundId: input.providerRefundId ?? null,
    actorUserId: input.actorUserId ?? null,
  };
}
