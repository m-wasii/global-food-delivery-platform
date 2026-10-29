import type { PriceBreakdown } from '../cart/pricing';

export interface MenuItemSnapshotSource {
  id: string;
  name: string;
}

export interface OrderItemSnapshot {
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface AddressSnapshot {
  deliveryAddressId: string | null;
  deliveryLabel: string | null;
  deliveryLine1: string | null;
  deliveryLine2: string | null;
  deliveryCity: string | null;
  deliveryRegion: string | null;
  deliveryPostalCode: string | null;
  deliveryCountry: string | null;
}

/**
 * Freeze line names/prices from the pricing quote + live menu names.
 * Resulting objects must not share references with mutable menu records.
 */
export function buildOrderItemSnapshots(
  pricing: PriceBreakdown,
  menuById: Map<string, MenuItemSnapshotSource>,
): OrderItemSnapshot[] {
  return pricing.lines.map((line) => {
    const menuItem = menuById.get(line.menuItemId);
    return {
      menuItemId: line.menuItemId,
      name: menuItem?.name ?? 'Item',
      unitPriceCents: line.unitPrice,
      quantity: line.quantity,
      lineTotalCents: line.lineTotal,
    };
  });
}

export function buildAddressSnapshot(
  address: {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
  } | null,
): AddressSnapshot {
  if (!address) {
    return {
      deliveryAddressId: null,
      deliveryLabel: null,
      deliveryLine1: null,
      deliveryLine2: null,
      deliveryCity: null,
      deliveryRegion: null,
      deliveryPostalCode: null,
      deliveryCountry: null,
    };
  }
  return {
    deliveryAddressId: address.id,
    deliveryLabel: address.label,
    deliveryLine1: address.line1,
    deliveryLine2: address.line2,
    deliveryCity: address.city,
    deliveryRegion: address.region,
    deliveryPostalCode: address.postalCode,
    deliveryCountry: address.country,
  };
}

export function buildPricingSnapshot(pricing: PriceBreakdown) {
  return {
    currency: pricing.currency,
    itemsSubtotalCents: pricing.itemsSubtotal,
    discountCents: pricing.discount,
    serviceFeeCents: pricing.serviceFee,
    deliveryFeeCents: pricing.deliveryFee,
    taxCents: pricing.tax,
    taxRateBps: pricing.taxRateBps,
    totalCents: pricing.total,
  };
}
