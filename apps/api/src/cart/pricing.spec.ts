import { describe, expect, it } from 'vitest';
import { priceCart } from './pricing';

describe('priceCart', () => {
  it('computes item lines and total with zero fees', () => {
    const result = priceCart({
      currency: 'USD',
      lines: [
        { menuItemId: 'a', quantity: 2, unitPrice: 500 },
        { menuItemId: 'b', quantity: 1, unitPrice: 300 },
      ],
    });

    expect(result.itemsSubtotal).toBe(1300);
    expect(result.discount).toBe(0);
    expect(result.serviceFee).toBe(0);
    expect(result.deliveryFee).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(1300);
    expect(result.lines[0]?.lineTotal).toBe(1000);
  });

  it('applies discount, fees, and tax on the marketplace taxable base', () => {
    // items 1000 - discount 100 = 900; + service 50 + delivery 150 = taxable 1100
    // tax 10% = 1100 * 1000 / 10000 = 110
    // total = 900 + 50 + 150 + 110 = 1210
    const result = priceCart({
      currency: 'USD',
      lines: [{ menuItemId: 'a', quantity: 1, unitPrice: 1000 }],
      discount: 100,
      serviceFee: 50,
      deliveryFee: 150,
      taxRateBps: 1000,
    });

    expect(result.itemsSubtotal).toBe(1000);
    expect(result.discount).toBe(100);
    expect(result.taxableSubtotal).toBe(1100);
    expect(result.tax).toBe(110);
    expect(result.total).toBe(1210);
  });

  it('clamps discount to itemsSubtotal and floors tax', () => {
    const result = priceCart({
      currency: 'USD',
      lines: [{ menuItemId: 'a', quantity: 1, unitPrice: 100 }],
      discount: 999,
      taxRateBps: 1, // 0.01% of 100 → floor to 0
    });
    expect(result.discount).toBe(100);
    expect(result.taxableSubtotal).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      currency: 'PKR',
      lines: [{ menuItemId: 'x', quantity: 3, unitPrice: 199 }],
      serviceFee: 10,
      deliveryFee: 25,
      taxRateBps: 500,
    };
    expect(priceCart(input)).toEqual(priceCart(input));
  });
});
