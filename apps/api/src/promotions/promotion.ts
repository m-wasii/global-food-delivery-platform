/**
 * Pure promotion eligibility + discount (EAT-50 / ADR 0020).
 * All money in currency minor units.
 */

export type PromotionDiscountType = 'PERCENT_OFF' | 'AMOUNT_OFF';

export type PromotionRejectionReason =
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'RESTAURANT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'MIN_SUBTOTAL'
  | 'MAX_REDEMPTIONS'
  | 'MAX_REDEMPTIONS_PER_USER'
  | 'INVALID_RULE';

export interface PromotionRule {
  id: string;
  code: string;
  active: boolean;
  discountType: PromotionDiscountType;
  /** Basis points; 1000 = 10%. Required for PERCENT_OFF. */
  percentOffBps: number | null;
  /** Minor units. Required for AMOUNT_OFF. */
  amountOffCents: number | null;
  /** Required when discountType is AMOUNT_OFF. */
  currency: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  minItemsSubtotalCents: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  redeemedCount: number;
  userRedeemedCount: number;
  /** Null = platform-wide. */
  restaurantId: string | null;
}

export interface EvaluatePromotionContext {
  now: Date;
  itemsSubtotal: number;
  currency: string;
  restaurantId: string;
}

export type EvaluatePromotionResult =
  | { ok: true; discount: number; promotionId: string }
  | { ok: false; reason: PromotionRejectionReason };

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

function assertNonNegativeInt(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (minor units)`);
  }
}

/**
 * Discount amount in minor units, clamped to itemsSubtotal.
 */
export function calculatePromotionDiscount(
  rule: Pick<
    PromotionRule,
    'discountType' | 'percentOffBps' | 'amountOffCents'
  >,
  itemsSubtotal: number,
): number {
  assertNonNegativeInt('itemsSubtotal', itemsSubtotal);

  if (rule.discountType === 'PERCENT_OFF') {
    const bps = rule.percentOffBps ?? 0;
    assertNonNegativeInt('percentOffBps', bps);
    return Math.min(itemsSubtotal, Math.floor((itemsSubtotal * bps) / 10_000));
  }

  const amount = rule.amountOffCents ?? 0;
  assertNonNegativeInt('amountOffCents', amount);
  return Math.min(itemsSubtotal, amount);
}

function ruleShapeValid(rule: PromotionRule): boolean {
  if (rule.discountType === 'PERCENT_OFF') {
    return (
      rule.percentOffBps != null &&
      Number.isInteger(rule.percentOffBps) &&
      rule.percentOffBps >= 0 &&
      rule.percentOffBps <= 10_000
    );
  }
  return (
    rule.amountOffCents != null &&
    Number.isInteger(rule.amountOffCents) &&
    rule.amountOffCents >= 0 &&
    rule.currency != null &&
    rule.currency.length > 0
  );
}

/**
 * Server-side eligibility. Same inputs ⇒ same result.
 */
export function evaluatePromotion(
  rule: PromotionRule,
  ctx: EvaluatePromotionContext,
): EvaluatePromotionResult {
  assertNonNegativeInt('itemsSubtotal', ctx.itemsSubtotal);

  if (!rule.active) return { ok: false, reason: 'INACTIVE' };
  if (!ruleShapeValid(rule)) return { ok: false, reason: 'INVALID_RULE' };

  if (rule.startsAt && ctx.now < rule.startsAt) {
    return { ok: false, reason: 'NOT_STARTED' };
  }
  if (rule.endsAt && ctx.now > rule.endsAt) {
    return { ok: false, reason: 'EXPIRED' };
  }

  if (rule.restaurantId && rule.restaurantId !== ctx.restaurantId) {
    return { ok: false, reason: 'RESTAURANT_MISMATCH' };
  }

  if (
    rule.discountType === 'AMOUNT_OFF' &&
    rule.currency &&
    rule.currency !== ctx.currency
  ) {
    return { ok: false, reason: 'CURRENCY_MISMATCH' };
  }

  if (
    rule.minItemsSubtotalCents != null &&
    ctx.itemsSubtotal < rule.minItemsSubtotalCents
  ) {
    return { ok: false, reason: 'MIN_SUBTOTAL' };
  }

  if (
    rule.maxRedemptions != null &&
    rule.redeemedCount >= rule.maxRedemptions
  ) {
    return { ok: false, reason: 'MAX_REDEMPTIONS' };
  }

  if (
    rule.maxRedemptionsPerUser != null &&
    rule.userRedeemedCount >= rule.maxRedemptionsPerUser
  ) {
    return { ok: false, reason: 'MAX_REDEMPTIONS_PER_USER' };
  }

  const discount = calculatePromotionDiscount(rule, ctx.itemsSubtotal);
  return { ok: true, discount, promotionId: rule.id };
}
