import { describe, expect, it } from 'vitest';
import {
  calculatePromotionDiscount,
  evaluatePromotion,
  normalizePromoCode,
  type PromotionRule,
} from './promotion';

function baseRule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: 'promo-1',
    code: 'SAVE10',
    active: true,
    discountType: 'PERCENT_OFF',
    percentOffBps: 1000,
    amountOffCents: null,
    currency: null,
    startsAt: null,
    endsAt: null,
    minItemsSubtotalCents: null,
    maxRedemptions: null,
    maxRedemptionsPerUser: null,
    redeemedCount: 0,
    userRedeemedCount: 0,
    restaurantId: null,
    ...overrides,
  };
}

const ctx = {
  now: new Date('2026-06-15T12:00:00.000Z'),
  itemsSubtotal: 2000,
  currency: 'USD',
  restaurantId: 'rest-1',
};

describe('normalizePromoCode', () => {
  it('trims and uppercases customer-facing codes', () => {
    expect(normalizePromoCode('  save10 ')).toBe('SAVE10');
  });
});

describe('calculatePromotionDiscount', () => {
  it('computes percent-off from basis points floored to minor units', () => {
    expect(
      calculatePromotionDiscount(baseRule({ percentOffBps: 1250 }), 999),
    ).toBe(124);
  });

  it('computes amount-off and clamps to items subtotal', () => {
    expect(
      calculatePromotionDiscount(
        baseRule({
          discountType: 'AMOUNT_OFF',
          percentOffBps: null,
          amountOffCents: 500,
          currency: 'USD',
        }),
        300,
      ),
    ).toBe(300);
  });
});

describe('evaluatePromotion', () => {
  it('accepts an eligible percent-off promotion and returns discount', () => {
    const result = evaluatePromotion(baseRule(), ctx);
    expect(result).toEqual({ ok: true, discount: 200, promotionId: 'promo-1' });
  });

  it('rejects inactive promotions', () => {
    expect(evaluatePromotion(baseRule({ active: false }), ctx)).toEqual({
      ok: false,
      reason: 'INACTIVE',
    });
  });

  it('rejects before startsAt and after endsAt', () => {
    expect(
      evaluatePromotion(
        baseRule({ startsAt: new Date('2026-07-01T00:00:00.000Z') }),
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'NOT_STARTED' });

    expect(
      evaluatePromotion(
        baseRule({ endsAt: new Date('2026-06-01T00:00:00.000Z') }),
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('rejects restaurant-scoped codes on other restaurants', () => {
    expect(
      evaluatePromotion(baseRule({ restaurantId: 'rest-other' }), ctx),
    ).toEqual({ ok: false, reason: 'RESTAURANT_MISMATCH' });
  });

  it('rejects when items subtotal is below the minimum', () => {
    expect(
      evaluatePromotion(baseRule({ minItemsSubtotalCents: 2500 }), ctx),
    ).toEqual({ ok: false, reason: 'MIN_SUBTOTAL' });
  });

  it('rejects when global or per-user redemption limits are exhausted', () => {
    expect(
      evaluatePromotion(
        baseRule({ maxRedemptions: 10, redeemedCount: 10 }),
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'MAX_REDEMPTIONS' });

    expect(
      evaluatePromotion(
        baseRule({ maxRedemptionsPerUser: 1, userRedeemedCount: 1 }),
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'MAX_REDEMPTIONS_PER_USER' });
  });

  it('rejects amount-off when currency does not match the cart', () => {
    expect(
      evaluatePromotion(
        baseRule({
          discountType: 'AMOUNT_OFF',
          percentOffBps: null,
          amountOffCents: 100,
          currency: 'EUR',
        }),
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'CURRENCY_MISMATCH' });
  });
});
