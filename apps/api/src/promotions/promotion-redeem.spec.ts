import { describe, expect, it } from 'vitest';
import { toPromotionRule } from './promotion-redeem';

describe('toPromotionRule', () => {
  it('maps a locked promotion row plus user redemption count into an evaluable rule', () => {
    const rule = toPromotionRule(
      {
        id: 'p1',
        code: 'SAVE10',
        active: true,
        discountType: 'PERCENT_OFF',
        percentOffBps: 1000,
        amountOffCents: null,
        currency: null,
        startsAt: null,
        endsAt: null,
        minItemsSubtotalCents: 500,
        maxRedemptions: 100,
        maxRedemptionsPerUser: 1,
        redeemedCount: 4,
        restaurantId: null,
      },
      1,
    );

    expect(rule).toMatchObject({
      id: 'p1',
      code: 'SAVE10',
      redeemedCount: 4,
      userRedeemedCount: 1,
      minItemsSubtotalCents: 500,
    });
  });
});
