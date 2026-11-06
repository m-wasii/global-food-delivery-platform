import {
  PAYMENT_STATUSES,
  type PaymentStatusValue,
} from './payment-provider';

export type { PaymentStatusValue };

export const PAYMENT_TRANSITION_STATUSES = PAYMENT_STATUSES;

const ALLOWED: Record<PaymentStatusValue, readonly PaymentStatusValue[]> = {
  REQUIRES_ACTION: ['PROCESSING', 'AUTHORIZED', 'FAILED', 'CANCELED'],
  PROCESSING: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELED'],
  AUTHORIZED: ['CAPTURED', 'CANCELED', 'FAILED'],
  CAPTURED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REFUNDED: [],
  FAILED: ['REQUIRES_ACTION', 'PROCESSING', 'AUTHORIZED'],
  CANCELED: [],
};

export function canTransitionPayment(
  from: PaymentStatusValue,
  to: PaymentStatusValue,
): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function assertCanTransitionPayment(
  from: PaymentStatusValue,
  to: PaymentStatusValue,
): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}`);
  }
}

export function allowedPaymentTargets(
  from: PaymentStatusValue,
): readonly PaymentStatusValue[] {
  return ALLOWED[from];
}
