import type { OrderStatusValue } from '../orders/order-transitions';
import type { PaymentStatusValue } from './payment-provider';
import { assertOrderPaymentConsistent } from './order-payment-consistency';
import { assertCanTransitionPayment } from './payment-transitions';

export function providerDivergesFromLocal(
  localStatus: PaymentStatusValue,
  providerStatus: PaymentStatusValue,
): boolean {
  return localStatus !== providerStatus;
}

export function nextPaymentAttemptCount(
  from: PaymentStatusValue,
  to: PaymentStatusValue,
  attemptCount: number,
): number {
  if (from === 'FAILED' && to !== 'FAILED') return attemptCount + 1;
  return attemptCount;
}

export function planPaymentStatusChange(input: {
  from: PaymentStatusValue;
  to: PaymentStatusValue;
  orderStatus: OrderStatusValue;
  attemptCount: number;
}): { to: PaymentStatusValue; attemptCount: number } {
  assertCanTransitionPayment(input.from, input.to);
  assertOrderPaymentConsistent(input.orderStatus, input.to);
  return {
    to: input.to,
    attemptCount: nextPaymentAttemptCount(
      input.from,
      input.to,
      input.attemptCount,
    ),
  };
}

export function planPaymentCreate(input: {
  orderStatus: OrderStatusValue;
  paymentStatus: PaymentStatusValue;
}): void {
  assertOrderPaymentConsistent(input.orderStatus, input.paymentStatus);
}
