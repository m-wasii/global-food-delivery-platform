import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdempotencyConflictError } from '../common/idempotency';

export function checkoutConfirmScope(userId: string, restaurantId: string) {
  return `checkout.confirm:${userId}:${restaurantId}`;
}

export function checkoutConfirmRequest(dto: {
  fulfillment: 'DELIVERY' | 'PICKUP';
  deliveryAddressId?: string;
  discoveryAddressId?: string;
}) {
  return {
    fulfillment: dto.fulfillment,
    deliveryAddressId: dto.deliveryAddressId ?? null,
    discoveryAddressId: dto.discoveryAddressId ?? null,
  };
}

export function normalizeIdempotencyKey(header: string | undefined): string {
  if (typeof header !== 'string' || header.trim().length === 0) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  const key = header.trim();
  if (key.length > 255) {
    throw new BadRequestException('Idempotency-Key must be at most 255 characters');
  }
  return key;
}

export function toHttpIdempotencyError(err: IdempotencyConflictError) {
  return new ConflictException(err.message);
}
