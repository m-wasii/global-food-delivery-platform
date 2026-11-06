import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdempotencyConflictError } from './idempotency';

/** Stripe-aligned: client key required, ≤255 chars (ADR 0016). */
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
