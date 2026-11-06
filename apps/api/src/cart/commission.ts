/**
 * Marketplace settlement: restaurant commission vs platform revenue.
 * Amounts are integers in the currency's minor unit. Customer tax is out of scope.
 */

export interface SettleOrderInput {
  itemsSubtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  /** Basis points (1% = 100). Applied to (itemsSubtotal - discount). */
  commissionRateBps: number;
}

export interface SettlementBreakdown {
  /** itemsSubtotal - discount (clamped). Commission base. */
  commissionBase: number;
  commissionRateBps: number;
  /** Platform cut of food sales. */
  commission: number;
  /** What the restaurant is owed for food. */
  restaurantNet: number;
  /**
   * Platform take: commission + customer-facing fees (service + delivery).
   * Tax is collected separately and not treated as platform revenue here.
   */
  platformRevenue: number;
}

function assertNonNegativeInt(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (minor units)`);
  }
}

/**
 * Deterministic order settlement. Same inputs ⇒ same breakdown.
 */
export function settleOrder(input: SettleOrderInput): SettlementBreakdown {
  assertNonNegativeInt('itemsSubtotal', input.itemsSubtotal);
  assertNonNegativeInt('discount', input.discount);
  assertNonNegativeInt('serviceFee', input.serviceFee);
  assertNonNegativeInt('deliveryFee', input.deliveryFee);
  assertNonNegativeInt('commissionRateBps', input.commissionRateBps);

  const commissionBase = Math.max(0, input.itemsSubtotal - input.discount);
  const commission = Math.floor((commissionBase * input.commissionRateBps) / 10_000);
  const restaurantNet = commissionBase - commission;
  const platformRevenue = commission + input.serviceFee + input.deliveryFee;

  return {
    commissionBase,
    commissionRateBps: input.commissionRateBps,
    commission,
    restaurantNet,
    platformRevenue,
  };
}

export interface SettlementClawbackInput {
  settlement: SettlementBreakdown;
  /** Customer-facing order total (minor units), including tax. */
  orderTotal: number;
  /** Amount being refunded to the customer (minor units). */
  refundAmount: number;
}

export interface SettlementClawback {
  commission: number;
  restaurantNet: number;
  platformRevenue: number;
}

/**
 * Proportional clawback of snapshotted settlement when refunding the customer.
 * PSP marketplace split instructions remain deferred (ADR 0014); this plans the books.
 */
export function planSettlementClawback(
  input: SettlementClawbackInput,
): SettlementClawback {
  assertNonNegativeInt('orderTotal', input.orderTotal);
  assertNonNegativeInt('refundAmount', input.refundAmount);
  if (input.refundAmount > input.orderTotal) {
    throw new Error('refundAmount cannot exceed orderTotal');
  }
  if (input.orderTotal === 0) {
    return { commission: 0, restaurantNet: 0, platformRevenue: 0 };
  }

  const scale = (amount: number) =>
    Math.floor((amount * input.refundAmount) / input.orderTotal);

  return {
    commission: scale(input.settlement.commission),
    restaurantNet: scale(input.settlement.restaurantNet),
    platformRevenue: scale(input.settlement.platformRevenue),
  };
}
