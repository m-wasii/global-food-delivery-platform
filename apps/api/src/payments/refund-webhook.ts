import type { OrderStatusValue } from '../orders/order-transitions';
import type { PaymentStatusValue } from './payment-provider';
import type { RefundStatusValue } from './refund-record';
import { assertOrderPaymentConsistent } from './order-payment-consistency';
import { assertCanTransitionPayment } from './payment-transitions';

export interface RefundWebhookApplyInput {
  currentRefundStatus: RefundStatusValue;
  nextRefundStatus: RefundStatusValue;
  paymentStatus: PaymentStatusValue;
  orderStatus: OrderStatusValue;
  amountReceivedCents: number;
  refundedAmountCents: number;
  refundAmountCents: number;
}

export interface RefundWebhookPaymentPlan {
  nextStatus: PaymentStatusValue;
  nextRefundedAmountCents: number;
  statusChanged: boolean;
  /** True when undoing a previously counted SUCCEEDED refund. */
  reverseAmounts: boolean;
}

export type RefundWebhookApplyPlan =
  | {
      noop: true;
      refundStatus: RefundStatusValue;
    }
  | {
      noop: false;
      refundStatus: RefundStatusValue;
      payment?: RefundWebhookPaymentPlan;
    };

/**
 * Pure settlement plan for async refund webhooks (Stripe refund.updated /
 * refund.failed, Adyen REFUND / REFUND_FAILED).
 *
 * Amounts are counted only while the refund row is SUCCEEDED:
 * - PENDING → SUCCEEDED adds the amount
 * - SUCCEEDED → FAILED reverses it
 * - PENDING → FAILED leaves payment untouched
 * - Same status → idempotent no-op (duplicate delivery)
 */
export function planRefundWebhookApply(
  input: RefundWebhookApplyInput,
): RefundWebhookApplyPlan {
  if (input.currentRefundStatus === input.nextRefundStatus) {
    return { noop: true, refundStatus: input.nextRefundStatus };
  }

  if (
    input.currentRefundStatus === 'PENDING' &&
    input.nextRefundStatus === 'SUCCEEDED'
  ) {
    return {
      noop: false,
      refundStatus: 'SUCCEEDED',
      payment: planAmountBump(input),
    };
  }

  if (
    input.currentRefundStatus === 'SUCCEEDED' &&
    input.nextRefundStatus === 'FAILED'
  ) {
    return {
      noop: false,
      refundStatus: 'FAILED',
      payment: planAmountReverse(input),
    };
  }

  if (
    input.currentRefundStatus === 'PENDING' &&
    input.nextRefundStatus === 'FAILED'
  ) {
    return { noop: false, refundStatus: 'FAILED' };
  }

  throw new Error(
    `Unsupported refund webhook transition: ${input.currentRefundStatus} → ${input.nextRefundStatus}`,
  );
}

function paymentStatusForRefundedAmount(
  amountReceivedCents: number,
  nextRefundedAmountCents: number,
): PaymentStatusValue {
  if (nextRefundedAmountCents <= 0) return 'CAPTURED';
  if (nextRefundedAmountCents >= amountReceivedCents) return 'REFUNDED';
  return 'PARTIALLY_REFUNDED';
}

function planAmountBump(
  input: RefundWebhookApplyInput,
): RefundWebhookPaymentPlan {
  const nextRefundedAmountCents =
    input.refundedAmountCents + input.refundAmountCents;
  if (nextRefundedAmountCents > input.amountReceivedCents) {
    throw new Error('Refund amount exceeds captured remainder');
  }
  const nextStatus = paymentStatusForRefundedAmount(
    input.amountReceivedCents,
    nextRefundedAmountCents,
  );
  const statusChanged = nextStatus !== input.paymentStatus;
  if (statusChanged) {
    assertCanTransitionPayment(input.paymentStatus, nextStatus);
  }
  assertOrderPaymentConsistent(input.orderStatus, nextStatus);
  return {
    nextStatus,
    nextRefundedAmountCents,
    statusChanged,
    reverseAmounts: false,
  };
}

function planAmountReverse(
  input: RefundWebhookApplyInput,
): RefundWebhookPaymentPlan {
  const nextRefundedAmountCents =
    input.refundedAmountCents - input.refundAmountCents;
  if (nextRefundedAmountCents < 0) {
    throw new Error('Refund reversal would make refunded amount negative');
  }
  const nextStatus = paymentStatusForRefundedAmount(
    input.amountReceivedCents,
    nextRefundedAmountCents,
  );
  const statusChanged = nextStatus !== input.paymentStatus;
  if (statusChanged) {
    assertCanTransitionPayment(input.paymentStatus, nextStatus);
  }
  assertOrderPaymentConsistent(input.orderStatus, nextStatus);
  return {
    nextStatus,
    nextRefundedAmountCents,
    statusChanged,
    reverseAmounts: true,
  };
}
