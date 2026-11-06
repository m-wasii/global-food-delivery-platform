import type { PromotionRejectionReason } from './promotion';

export type PromotionHttpReason = PromotionRejectionReason | 'NOT_FOUND';

const MESSAGES: Record<PromotionHttpReason, string> = {
  NOT_FOUND: 'Promotion code is invalid',
  INACTIVE: 'Promotion code is inactive',
  NOT_STARTED: 'Promotion code is not active yet',
  EXPIRED: 'Promotion code has expired',
  RESTAURANT_MISMATCH: 'Promotion code is not valid for this restaurant',
  CURRENCY_MISMATCH: 'Promotion code currency does not match the cart',
  MIN_SUBTOTAL: 'Cart subtotal is below the promotion minimum',
  MAX_REDEMPTIONS: 'Promotion code has reached its redemption limit',
  MAX_REDEMPTIONS_PER_USER:
    'You have already used this promotion code the maximum number of times',
  INVALID_RULE: 'Promotion code is misconfigured',
};

export function promotionRejectionMessage(reason: PromotionHttpReason): string {
  return MESSAGES[reason];
}
