export function refundIssueScope(paymentId: string) {
  return `payments.refund:${paymentId}`;
}

export function refundIssueRequest(input: {
  amountCents: number;
  reason?: string | null;
}) {
  return {
    amountCents: input.amountCents,
    reason: input.reason ?? null,
  };
}

export interface RefundHttpRefundRow {
  id: string;
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: string;
  reason: string | null;
  providerRefundId: string | null;
  actorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundHttpPaymentRow {
  id: string;
  orderId: string;
  status: string;
  refundedAmountCents: number;
  amountReceivedCents: number;
}

/**
 * HTTP body for a successful refund issue (EAT-79).
 * Always includes the refund row linked to both order and payment.
 */
function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

export function toRefundHttpResponse(input: {
  refund: RefundHttpRefundRow;
  payment: RefundHttpPaymentRow;
}) {
  return {
    refund: {
      id: input.refund.id,
      paymentId: input.refund.paymentId,
      orderId: input.refund.orderId,
      amountCents: input.refund.amountCents,
      currency: input.refund.currency,
      status: input.refund.status,
      reason: input.refund.reason,
      providerRefundId: input.refund.providerRefundId,
      actorUserId: input.refund.actorUserId,
      // ISO strings so idempotent JSON replay matches the first response.
      createdAt: toIso(input.refund.createdAt),
      updatedAt: toIso(input.refund.updatedAt),
    },
    payment: {
      id: input.payment.id,
      orderId: input.payment.orderId,
      status: input.payment.status,
      refundedAmountCents: input.payment.refundedAmountCents,
      amountReceivedCents: input.payment.amountReceivedCents,
    },
  };
}
