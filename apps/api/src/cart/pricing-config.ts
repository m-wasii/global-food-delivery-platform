/**
 * Pluggable fee/tax defaults for M04. Rich rules land in EAT-49 / EAT-70.
 * Amounts are minor units of the cart currency; tax is basis points.
 */
export interface PricingDefaults {
  serviceFee: number;
  deliveryFee: number;
  taxRateBps: number;
}

function readNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export function loadPricingDefaults(): PricingDefaults {
  return {
    serviceFee: readNonNegativeInt('PRICING_SERVICE_FEE_MINOR', 0),
    deliveryFee: readNonNegativeInt('PRICING_DELIVERY_FEE_MINOR', 0),
    taxRateBps: readNonNegativeInt('PRICING_TAX_RATE_BPS', 0),
  };
}
