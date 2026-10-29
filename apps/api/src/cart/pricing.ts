/**
 * Monetary amounts are integers in the currency's **minor unit**
 * (e.g. cents, fils) — never floating-point major units.
 */

export interface PriceLineInput {
  menuItemId: string;
  quantity: number;
  /** Minor-unit price for one unit. */
  unitPrice: number;
}

export interface PriceCartInput {
  currency: string;
  lines: PriceLineInput[];
  /** Minor units; clamped to itemsSubtotal. */
  discount?: number;
  /** Minor units. */
  serviceFee?: number;
  /** Minor units. */
  deliveryFee?: number;
  /**
   * Tax rate in basis points (1% = 100 bps).
   * Applied to (itemsSubtotal - discount) + serviceFee + deliveryFee.
   */
  taxRateBps?: number;
}

export interface PriceLine {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PriceBreakdown {
  currency: string;
  lines: PriceLine[];
  itemsSubtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  taxRateBps: number;
  /** (itemsSubtotal - discount) + serviceFee + deliveryFee */
  taxableSubtotal: number;
  total: number;
}

function assertNonNegativeInt(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (minor units)`);
  }
}

/**
 * Deterministic cart pricing. Same inputs ⇒ same breakdown.
 */
export function priceCart(input: PriceCartInput): PriceBreakdown {
  const discountIn = input.discount ?? 0;
  const serviceFee = input.serviceFee ?? 0;
  const deliveryFee = input.deliveryFee ?? 0;
  const taxRateBps = input.taxRateBps ?? 0;

  assertNonNegativeInt('discount', discountIn);
  assertNonNegativeInt('serviceFee', serviceFee);
  assertNonNegativeInt('deliveryFee', deliveryFee);
  assertNonNegativeInt('taxRateBps', taxRateBps);

  if (input.lines.length === 0) {
    throw new Error('Cannot price an empty cart');
  }

  const lines: PriceLine[] = input.lines.map((line) => {
    assertNonNegativeInt('quantity', line.quantity);
    if (line.quantity < 1) {
      throw new Error('quantity must be at least 1');
    }
    assertNonNegativeInt('unitPrice', line.unitPrice);
    return {
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.quantity,
    };
  });

  const itemsSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = Math.min(discountIn, itemsSubtotal);
  const afterDiscount = itemsSubtotal - discount;
  const taxableSubtotal = afterDiscount + serviceFee + deliveryFee;
  const tax = Math.floor((taxableSubtotal * taxRateBps) / 10_000);
  const total = afterDiscount + serviceFee + deliveryFee + tax;

  return {
    currency: input.currency,
    lines,
    itemsSubtotal,
    discount,
    serviceFee,
    deliveryFee,
    tax,
    taxRateBps,
    taxableSubtotal,
    total,
  };
}
