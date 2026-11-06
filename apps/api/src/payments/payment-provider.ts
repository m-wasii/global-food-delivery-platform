import type { NormalizedRefundWebhook } from './refund-webhook-parse';

/**
 * Provider-neutral payment port (EAT-45).
 * Verbs mirror Stripe PaymentIntents + Adyen Checkout modifications:
 * authorize (manual capture), capture, cancel, refund, getStatus, parseWebhook.
 * Order/checkout code depends on this interface — never a vendor SDK.
 * Amounts are integer minor units (cents), matching the pricing engine.
 */

export type { NormalizedRefundWebhook };

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * Domain statuses mapped from common PSP lifecycles:
 * - REQUIRES_ACTION ≈ Stripe `requires_action` (SCA / 3DS)
 * - PROCESSING ≈ async methods / capture in flight
 * - AUTHORIZED ≈ Stripe `requires_capture` / Adyen Authorised
 * - CAPTURED ≈ Stripe `succeeded` / Adyen Captured
 */
export const PAYMENT_STATUSES = [
  'REQUIRES_ACTION',
  'PROCESSING',
  'AUTHORIZED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'CANCELED',
] as const;

export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export interface AuthorizePaymentInput {
  amountCents: number;
  /** ISO 4217 */
  currency: string;
  orderId: string;
  customerId: string;
  /**
   * Required on every mutating call (Stripe / Purse guidance).
   * Persistence + replay semantics land in EAT-47.
   */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface CapturePaymentInput {
  providerPaymentId: string;
  /**
   * Partial capture supported (Stripe `amount_to_capture`).
   * Omit to capture the full capturable remainder.
   */
  amountCents?: number;
  idempotencyKey: string;
}

export interface CancelPaymentInput {
  providerPaymentId: string;
  idempotencyKey: string;
  /** e.g. abandoned | duplicate | requested_by_customer | fraudulent */
  reason?: string;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amountCents: number;
  idempotencyKey: string;
  reason?: string;
}

export interface PaymentSnapshot {
  provider: string;
  providerPaymentId: string;
  status: PaymentStatusValue;
  /** Authorized / captured principal currently on the payment (minor units). */
  amountCents: number;
  currency: string;
  /** Remaining hold available to capture (Stripe `amount_capturable`). */
  amountCapturableCents: number;
  /** Funds captured so far (Stripe `amount_received`). */
  amountReceivedCents: number;
  refundedAmountCents: number;
}

/**
 * Swap Stripe / Adyen / regional rails without rewriting order logic.
 */
export interface PaymentProvider {
  readonly name: string;
  authorize(input: AuthorizePaymentInput): Promise<PaymentSnapshot>;
  capture(input: CapturePaymentInput): Promise<PaymentSnapshot>;
  /** Release an uncaptured authorization (Stripe cancel / Adyen cancel). */
  cancel(input: CancelPaymentInput): Promise<PaymentSnapshot>;
  refund(input: RefundPaymentInput): Promise<PaymentSnapshot>;
  getStatus(providerPaymentId: string): Promise<PaymentSnapshot>;
  /**
   * Normalize a provider webhook payload. Refund settlement events return a
   * `NormalizedRefundWebhook`; unrelated payloads return null (EAT-80).
   */
  parseWebhook(payload: unknown): Promise<NormalizedRefundWebhook | null>;
}
