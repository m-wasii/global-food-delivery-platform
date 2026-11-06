import type { OrderStatusValue } from '../orders/order-transitions';
import type { PaymentStatusValue } from './payment-provider';

/**
 * Allowed payment statuses for each order status (ADR 0015).
 * Prevents silent divergence between kitchen/order FSM and money FSM.
 */
const ALLOWED: Record<OrderStatusValue, readonly PaymentStatusValue[]> = {
  PENDING: ['REQUIRES_ACTION', 'PROCESSING', 'AUTHORIZED'],
  CONFIRMED: ['CAPTURED'],
  PREPARING: ['CAPTURED'],
  READY: ['CAPTURED'],
  COMPLETED: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  CANCELLED: ['CANCELED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
  REJECTED: ['CANCELED', 'FAILED'],
};

export function isOrderPaymentConsistent(
  orderStatus: OrderStatusValue,
  paymentStatus: PaymentStatusValue,
): boolean {
  return ALLOWED[orderStatus].includes(paymentStatus);
}

export function assertOrderPaymentConsistent(
  orderStatus: OrderStatusValue,
  paymentStatus: PaymentStatusValue,
): void {
  if (!isOrderPaymentConsistent(orderStatus, paymentStatus)) {
    throw new Error(
      `Order and payment state diverge: order=${orderStatus} payment=${paymentStatus}`,
    );
  }
}

export function allowedPaymentStatusesForOrder(
  orderStatus: OrderStatusValue,
): readonly PaymentStatusValue[] {
  return ALLOWED[orderStatus];
}

/**
 * Order transitions call this when a Payment row may exist.
 * Missing payment is allowed (pre-checkout / legacy); present payment must align.
 */
export function assertOrderTransitionKeepsPaymentAligned(
  nextOrderStatus: OrderStatusValue,
  paymentStatus: PaymentStatusValue | null | undefined,
): void {
  if (paymentStatus == null) return;
  assertOrderPaymentConsistent(nextOrderStatus, paymentStatus);
}
