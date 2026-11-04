/**
 * Partner reject reason codes (EAT-41).
 * Mirrors cancel: required enum + optional free-text note on history.
 */

export const REJECT_REASONS = [
  'OUT_OF_STOCK',
  'TOO_BUSY',
  'CLOSING_SOON',
  'OTHER',
] as const;

export type RejectReasonCode = (typeof REJECT_REASONS)[number];

/** Persist as `CODE` or `CODE: note` on OrderStatusHistory.reason. */
export function formatRejectHistoryReason(
  code: RejectReasonCode,
  note?: string,
): string {
  const trimmed = note?.trim();
  return trimmed ? `${code}: ${trimmed}` : code;
}
