/**
 * Customer cancel window + reason codes (EAT-38).
 * Partner/admin are not bound by the clock — only by the state machine.
 */

export const CANCEL_REASONS = [
  'CHANGED_MIND',
  'WRONG_ITEMS',
  'TOO_LONG',
  'OTHER',
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number];

const DEFAULT_CUSTOMER_WINDOW_MINUTES = 7;

export function loadCustomerCancelWindowMs(): number {
  const raw = process.env.CUSTOMER_CANCEL_WINDOW_MINUTES;
  if (raw === undefined || raw === '') {
    return DEFAULT_CUSTOMER_WINDOW_MINUTES * 60_000;
  }
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error('CUSTOMER_CANCEL_WINDOW_MINUTES must be a non-negative integer');
  }
  return minutes * 60_000;
}

export function isCustomerCancelWindowOpen(
  createdAt: Date,
  now: Date,
  windowMs: number,
): boolean {
  return now.getTime() - createdAt.getTime() <= windowMs;
}

/** Persist as `CODE` or `CODE: note` on OrderStatusHistory.reason. */
export function formatCancelHistoryReason(
  code: CancelReasonCode,
  note?: string,
): string {
  const trimmed = note?.trim();
  return trimmed ? `${code}: ${trimmed}` : code;
}
