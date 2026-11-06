import type { OrderStatusValue } from '../orders/order-transitions';
import type { PaymentStatusValue } from './payment-provider';
import { assertOrderPaymentConsistent } from './order-payment-consistency';
import { assertCanTransitionPayment } from './payment-transitions';

export interface RefundPlanInput {
  paymentStatus: PaymentStatusValue;
  orderStatus: OrderStatusValue;
  amountReceivedCents: number;
  refundedAmountCents: number;
  refundAmountCents: number;
}

export interface RefundPlan {
  kind: 'full' | 'partial';
  nextPaymentStatus: PaymentStatusValue;
  nextRefundedAmountCents: number;
  /** False when a further partial stays on PARTIALLY_REFUNDED (ADR 0015). */
  statusChanged: boolean;
}

const REFUNDABLE: readonly PaymentStatusValue[] = [
  'CAPTURED',
  'PARTIALLY_REFUNDED',
];

export function refundableRemainingCents(payment: {
  amountReceivedCents: number;
  refundedAmountCents: number;
}): number {
  return payment.amountReceivedCents - payment.refundedAmountCents;
}

/**
 * Stripe/Adyen-aligned refund planning: positive minor units, never over the
 * captured remainder, only after capture; cancel uncaptured auths instead.
 */
export function planRefund(input: RefundPlanInput): RefundPlan {
  if (
    !Number.isInteger(input.refundAmountCents) ||
    input.refundAmountCents <= 0
  ) {
    throw new Error('Refund amount must be a positive integer (minor units)');
  }
  if (!REFUNDABLE.includes(input.paymentStatus)) {
    throw new Error(
      `Cannot refund payment in status ${input.paymentStatus}`,
    );
  }

  const remaining = refundableRemainingCents(input);
  if (input.refundAmountCents > remaining) {
    throw new Error('Refund amount exceeds captured remainder');
  }

  const nextRefundedAmountCents =
    input.refundedAmountCents + input.refundAmountCents;
  const nextPaymentStatus: PaymentStatusValue =
    nextRefundedAmountCents >= input.amountReceivedCents
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';
  const statusChanged = nextPaymentStatus !== input.paymentStatus;

  if (statusChanged) {
    assertCanTransitionPayment(input.paymentStatus, nextPaymentStatus);
  }
  assertOrderPaymentConsistent(input.orderStatus, nextPaymentStatus);

  return {
    kind:
      nextPaymentStatus === 'REFUNDED' &&
      nextRefundedAmountCents === input.amountReceivedCents
        ? 'full'
        : 'partial',
    nextPaymentStatus,
    nextRefundedAmountCents,
    statusChanged,
  };
}
