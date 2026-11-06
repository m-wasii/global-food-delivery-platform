import type { RefundStatusValue } from './refund-record';

/**
 * Provider-neutral refund settlement event produced by `parseWebhook`
 * (Stripe refund.* / Adyen REFUND* → EAT-80).
 */
export interface NormalizedRefundWebhook {
  kind: 'refund';
  provider: string;
  providerEventId: string | null;
  providerRefundId: string;
  providerPaymentId: string | null;
  status: RefundStatusValue;
  amountCents: number | null;
  failureReason: string | null;
}

function mapStripeRefundStatus(status: unknown): RefundStatusValue | null {
  if (status === 'succeeded') return 'SUCCEEDED';
  if (status === 'failed' || status === 'canceled') return 'FAILED';
  if (status === 'pending' || status === 'requires_action') return 'PENDING';
  return null;
}

/**
 * Stripe Events API: `refund.updated` / `refund.failed` with Refund object.
 * @see https://docs.stripe.com/api/events/types
 * @see https://docs.stripe.com/api/refunds/object
 */
export function parseStripeRefundWebhook(
  payload: unknown,
): NormalizedRefundWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const type = root.type;
  if (type !== 'refund.updated' && type !== 'refund.failed') return null;

  const data = root.data;
  if (!data || typeof data !== 'object') return null;
  const object = (data as Record<string, unknown>).object;
  if (!object || typeof object !== 'object') return null;
  const refund = object as Record<string, unknown>;
  if (refund.object !== 'refund') return null;
  if (typeof refund.id !== 'string' || refund.id.length === 0) return null;

  const status =
    type === 'refund.failed'
      ? 'FAILED'
      : mapStripeRefundStatus(refund.status);
  if (!status) return null;

  return {
    kind: 'refund',
    provider: 'stripe',
    providerEventId: typeof root.id === 'string' ? root.id : null,
    providerRefundId: refund.id,
    providerPaymentId:
      typeof refund.payment_intent === 'string' ? refund.payment_intent : null,
    status,
    amountCents:
      typeof refund.amount === 'number' && Number.isInteger(refund.amount)
        ? refund.amount
        : null,
    failureReason:
      typeof refund.failure_reason === 'string' ? refund.failure_reason : null,
  };
}

function firstAdyenNotificationItem(
  payload: unknown,
): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const items = (payload as Record<string, unknown>).notificationItems;
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0];
  if (!first || typeof first !== 'object') return null;
  const item = (first as Record<string, unknown>).NotificationRequestItem;
  if (!item || typeof item !== 'object') return null;
  return item as Record<string, unknown>;
}

/**
 * Adyen Standard webhook: eventCode REFUND / REFUND_FAILED.
 * @see https://docs.adyen.com/online-payments/refund
 */
export function parseAdyenRefundWebhook(
  payload: unknown,
): NormalizedRefundWebhook | null {
  const item = firstAdyenNotificationItem(payload);
  if (!item) return null;

  const eventCode = item.eventCode;
  if (eventCode !== 'REFUND' && eventCode !== 'REFUND_FAILED') return null;
  if (typeof item.pspReference !== 'string' || item.pspReference.length === 0) {
    return null;
  }

  const success = item.success === true || item.success === 'true';
  const status: RefundStatusValue =
    eventCode === 'REFUND_FAILED' || !success ? 'FAILED' : 'SUCCEEDED';

  const amount =
    item.amount && typeof item.amount === 'object'
      ? (item.amount as Record<string, unknown>).value
      : null;

  return {
    kind: 'refund',
    provider: 'adyen',
    providerEventId: `${eventCode}:${item.pspReference}`,
    providerRefundId: item.pspReference,
    providerPaymentId:
      typeof item.originalReference === 'string'
        ? item.originalReference
        : null,
    status,
    amountCents:
      typeof amount === 'number' && Number.isInteger(amount) ? amount : null,
    failureReason: typeof item.reason === 'string' && item.reason.length > 0
      ? item.reason
      : null,
  };
}

/**
 * Local/dev envelope for NoopPaymentProvider.parseWebhook.
 */
export function parseNoopRefundWebhook(
  payload: unknown,
): NormalizedRefundWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (root.type !== 'refund.updated' && root.type !== 'refund.failed') {
    return null;
  }
  const data = root.data;
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;
  if (
    typeof body.providerRefundId !== 'string' ||
    body.providerRefundId.length === 0
  ) {
    return null;
  }

  const status =
    root.type === 'refund.failed'
      ? 'FAILED'
      : body.status === 'failed'
        ? 'FAILED'
        : body.status === 'pending'
          ? 'PENDING'
          : body.status === 'succeeded'
            ? 'SUCCEEDED'
            : null;
  if (!status) return null;

  return {
    kind: 'refund',
    provider: 'noop',
    providerEventId: typeof root.id === 'string' ? root.id : null,
    providerRefundId: body.providerRefundId,
    providerPaymentId:
      typeof body.providerPaymentId === 'string'
        ? body.providerPaymentId
        : null,
    status,
    amountCents:
      typeof body.amountCents === 'number' &&
      Number.isInteger(body.amountCents)
        ? body.amountCents
        : null,
    failureReason:
      typeof body.failureReason === 'string' ? body.failureReason : null,
  };
}
