import { normalizePromoCode } from '../promotions/promotion';

export {
  normalizeIdempotencyKey,
  toHttpIdempotencyError,
} from '../common/idempotency-http';

export function checkoutConfirmScope(userId: string, restaurantId: string) {
  return `checkout.confirm:${userId}:${restaurantId}`;
}

export function checkoutConfirmRequest(dto: {
  fulfillment: 'DELIVERY' | 'PICKUP';
  deliveryAddressId?: string;
  discoveryAddressId?: string;
  promoCode?: string;
}) {
  return {
    fulfillment: dto.fulfillment,
    deliveryAddressId: dto.deliveryAddressId ?? null,
    discoveryAddressId: dto.discoveryAddressId ?? null,
    promoCode: dto.promoCode?.trim() ? normalizePromoCode(dto.promoCode) : null,
  };
}
