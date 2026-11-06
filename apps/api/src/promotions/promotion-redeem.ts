import { Prisma } from '@food-delivery/database';
import {
  evaluatePromotion,
  type PromotionDiscountType,
  type PromotionRejectionReason,
  type PromotionRule,
} from './promotion';

export class PromotionRedeemError extends Error {
  constructor(readonly reason: 'NOT_FOUND' | PromotionRejectionReason) {
    super(`Promotion redeem rejected: ${reason}`);
    this.name = 'PromotionRedeemError';
  }
}

type LockedPromotionRow = {
  id: string;
  code: string;
  active: boolean;
  discountType: PromotionDiscountType;
  percentOffBps: number | null;
  amountOffCents: number | null;
  currency: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  minItemsSubtotalCents: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  redeemedCount: number;
  restaurantId: string | null;
};

export function toPromotionRule(
  row: LockedPromotionRow,
  userRedeemedCount: number,
): PromotionRule {
  return {
    id: row.id,
    code: row.code,
    active: row.active,
    discountType: row.discountType,
    percentOffBps: row.percentOffBps,
    amountOffCents: row.amountOffCents,
    currency: row.currency,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    minItemsSubtotalCents: row.minItemsSubtotalCents,
    maxRedemptions: row.maxRedemptions,
    maxRedemptionsPerUser: row.maxRedemptionsPerUser,
    redeemedCount: row.redeemedCount,
    userRedeemedCount,
    restaurantId: row.restaurantId,
  };
}

/**
 * Lock promotion, re-evaluate, bump count, and record redemption.
 * Must run inside the order-create transaction.
 */
export async function redeemPromotionInTx(
  tx: Prisma.TransactionClient,
  input: {
    promotionId: string;
    userId: string;
    orderId: string;
    discountCents: number;
    itemsSubtotal: number;
    currency: string;
    restaurantId: string;
    now?: Date;
  },
): Promise<void> {
  const locked = await tx.$queryRaw<LockedPromotionRow[]>`
    SELECT
      id, code, active, "discountType", "percentOffBps", "amountOffCents",
      currency, "startsAt", "endsAt", "minItemsSubtotalCents",
      "maxRedemptions", "maxRedemptionsPerUser", "redeemedCount", "restaurantId"
    FROM "Promotion"
    WHERE id = ${input.promotionId}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) throw new PromotionRedeemError('NOT_FOUND');

  const userRedeemedCount = await tx.promotionRedemption.count({
    where: { promotionId: row.id, userId: input.userId },
  });

  const verdict = evaluatePromotion(toPromotionRule(row, userRedeemedCount), {
    now: input.now ?? new Date(),
    itemsSubtotal: input.itemsSubtotal,
    currency: input.currency,
    restaurantId: input.restaurantId,
  });

  if (!verdict.ok) throw new PromotionRedeemError(verdict.reason);
  if (verdict.discount !== input.discountCents) {
    throw new PromotionRedeemError('INVALID_RULE');
  }

  await tx.promotion.update({
    where: { id: row.id },
    data: { redeemedCount: { increment: 1 } },
  });

  await tx.promotionRedemption.create({
    data: {
      promotionId: row.id,
      userId: input.userId,
      orderId: input.orderId,
      discountCents: input.discountCents,
    },
  });
}
