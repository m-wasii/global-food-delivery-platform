/**
 * Default marketplace commission rate (EAT-49 / ADR 0019).
 * Rate is basis points of (itemsSubtotal - discount).
 */

function readNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

/** Default 15% (1500 bps) — typical food-delivery marketplace mid-tier. */
export function loadCommissionRateBps(): number {
  return readNonNegativeInt('COMMISSION_RATE_BPS', 1500);
}
