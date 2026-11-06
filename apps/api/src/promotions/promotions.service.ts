import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import {
  evaluatePromotion,
  normalizePromoCode,
} from './promotion';
import { promotionRejectionMessage } from './promotion-http';
import { toPromotionRule } from './promotion-redeem';

export interface ResolvedCheckoutPromotion {
  discount: number;
  promotionId: string | null;
  code: string | null;
}

@Injectable()
export class PromotionsService {
  /**
   * Resolve optional promo code for checkout. Rejects invalid/overused codes.
   */
  async resolveCheckoutPromotion(input: {
    promoCode?: string;
    userId: string;
    restaurantId: string;
    itemsSubtotal: number;
    currency: string;
    now?: Date;
  }): Promise<ResolvedCheckoutPromotion> {
    if (!input.promoCode?.trim()) {
      return { discount: 0, promotionId: null, code: null };
    }

    const code = normalizePromoCode(input.promoCode);
    const row = await prisma.promotion.findUnique({ where: { code } });
    if (!row) {
      throw new BadRequestException(promotionRejectionMessage('NOT_FOUND'));
    }

    const userRedeemedCount = await prisma.promotionRedemption.count({
      where: { promotionId: row.id, userId: input.userId },
    });

    const verdict = evaluatePromotion(toPromotionRule(row, userRedeemedCount), {
      now: input.now ?? new Date(),
      itemsSubtotal: input.itemsSubtotal,
      currency: input.currency,
      restaurantId: input.restaurantId,
    });

    if (!verdict.ok) {
      throw new BadRequestException(promotionRejectionMessage(verdict.reason));
    }

    return {
      discount: verdict.discount,
      promotionId: verdict.promotionId,
      code,
    };
  }
}
