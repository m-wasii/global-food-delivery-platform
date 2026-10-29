import { describe, expect, it } from 'vitest';
import { priceCart } from '../cart/pricing';
import {
  buildAddressSnapshot,
  buildOrderItemSnapshots,
  buildPricingSnapshot,
} from './order-creation';

describe('order creation snapshots', () => {
  it('keeps line name/price after the live menu object is mutated', () => {
    const menuItem = { id: 'mi-1', name: 'Burger', priceCents: 500 };
    const menuById = new Map([[menuItem.id, menuItem]]);
    const pricing = priceCart({
      currency: 'USD',
      lines: [{ menuItemId: 'mi-1', quantity: 2, unitPrice: menuItem.priceCents }],
    });

    const items = buildOrderItemSnapshots(pricing, menuById);
    menuItem.name = 'Changed Burger';
    menuItem.priceCents = 999;

    expect(items).toEqual([
      {
        menuItemId: 'mi-1',
        name: 'Burger',
        unitPriceCents: 500,
        quantity: 2,
        lineTotalCents: 1000,
      },
    ]);
  });

  it('copies address fields by value', () => {
    const address = {
      id: 'a1',
      label: 'Home',
      line1: '1 Main',
      line2: null,
      city: 'Lahore',
      region: 'Punjab',
      postalCode: '54000',
      country: 'PK',
    };
    const snap = buildAddressSnapshot(address);
    address.line1 = 'Moved';
    expect(snap.deliveryLine1).toBe('1 Main');
    expect(snap.deliveryAddressId).toBe('a1');
  });

  it('freezes pricing breakdown totals', () => {
    const pricing = priceCart({
      currency: 'USD',
      lines: [{ menuItemId: 'x', quantity: 1, unitPrice: 1000 }],
      serviceFee: 50,
      deliveryFee: 100,
      taxRateBps: 1000,
      discount: 0,
    });
    const snap = buildPricingSnapshot(pricing);
    expect(snap.totalCents).toBe(pricing.total);
    expect(snap.itemsSubtotalCents).toBe(1000);
    expect(snap.serviceFeeCents).toBe(50);
    expect(snap.deliveryFeeCents).toBe(100);
  });
});
