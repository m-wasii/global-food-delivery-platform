import { describe, expect, it } from 'vitest';
import { evaluateCartValidation, MAX_CART_LINE_QUANTITY } from './cart-validation';

function baseLine(overrides: Partial<Parameters<typeof evaluateCartValidation>[0]['lines'][0]> = {}) {
  return {
    cartItemId: 'ci-1',
    menuItemId: 'mi-1',
    quantity: 1,
    currency: 'USD',
    unitPriceCents: 1000,
    menuItemIsAvailable: true,
    menuIsActive: true,
    branchOffer: { isAvailable: true },
    ...overrides,
  };
}

function openBranch(overrides: Partial<Parameters<typeof evaluateCartValidation>[0]['branch']> = {}) {
  return {
    structurallyOrderable: true,
    isOpen: true,
    minimumOrderCents: null as number | null,
    ...overrides,
  };
}

describe('evaluateCartValidation', () => {
  it('accepts a healthy cart', () => {
    const result = evaluateCartValidation({
      cartCurrency: 'USD',
      branch: openBranch(),
      lines: [baseLine()],
    });
    expect(result.valid).toBe(true);
    expect(result.subtotalCents).toBe(1000);
    expect(result.issues).toEqual([]);
  });

  it('flags empty cart', () => {
    const result = evaluateCartValidation({
      cartCurrency: 'USD',
      branch: openBranch(),
      lines: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('EMPTY_CART');
  });

  it('flags closed branch and unoffered items without mutating input', () => {
    const result = evaluateCartValidation({
      cartCurrency: 'USD',
      branch: openBranch({ isOpen: false, closedReason: 'outside_weekly_hours' }),
      lines: [baseLine({ branchOffer: null })],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['BRANCH_CLOSED', 'ITEM_NOT_OFFERED']),
    );
  });

  it('flags out of stock at branch and below minimum order', () => {
    const result = evaluateCartValidation({
      cartCurrency: 'USD',
      branch: openBranch({ minimumOrderCents: 5000 }),
      lines: [baseLine({ branchOffer: { isAvailable: false }, quantity: 2 })],
    });
    expect(result.subtotalCents).toBe(2000);
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['ITEM_OUT_OF_STOCK', 'BELOW_MINIMUM_ORDER']),
    );
  });

  it('flags invalid quantity and currency mismatch', () => {
    const result = evaluateCartValidation({
      cartCurrency: 'USD',
      branch: openBranch(),
      lines: [
        baseLine({ quantity: MAX_CART_LINE_QUANTITY + 1 }),
        baseLine({
          cartItemId: 'ci-2',
          menuItemId: 'mi-2',
          currency: 'PKR',
        }),
      ],
    });
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['QUANTITY_INVALID', 'CURRENCY_MISMATCH']),
    );
  });
});
