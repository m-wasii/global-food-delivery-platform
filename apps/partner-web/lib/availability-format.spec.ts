import { describe, expect, it } from 'vitest';
import {
  WEEKDAY_LABELS,
  buildStockRows,
  formatMinutes,
  formatMoney,
} from './availability-format';
import type { MenuTree } from './availability-types';

describe('formatMinutes', () => {
  it('formats midnight and noon as HH:MM', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(12 * 60)).toBe('12:00');
  });

  it('pads minutes and wraps hours past 24', () => {
    expect(formatMinutes(9 * 60 + 5)).toBe('09:05');
    expect(formatMinutes(25 * 60)).toBe('01:00');
  });
});

describe('formatMoney', () => {
  it('renders cents as a fixed two-decimal amount with currency', () => {
    expect(formatMoney(1299, 'USD')).toBe('12.99 USD');
    expect(formatMoney(0, 'PKR')).toBe('0.00 PKR');
  });
});

describe('WEEKDAY_LABELS', () => {
  it('starts on Sunday and covers seven days', () => {
    expect(WEEKDAY_LABELS).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('buildStockRows', () => {
  const tree: MenuTree = {
    id: 'menu-1',
    name: 'Main',
    isActive: true,
    categories: [
      {
        id: 'cat-b',
        name: 'Sides',
        sortOrder: 2,
        items: [
          {
            id: 'item-side',
            name: 'Fries',
            priceCents: 399,
            currency: 'USD',
            isAvailable: true,
            sortOrder: 1,
          },
        ],
      },
      {
        id: 'cat-a',
        name: 'Mains',
        sortOrder: 1,
        items: [
          {
            id: 'item-burger',
            name: 'Burger',
            priceCents: 1299,
            currency: 'USD',
            isAvailable: true,
            sortOrder: 2,
          },
          {
            id: 'item-salad',
            name: 'Salad',
            priceCents: 899,
            currency: 'USD',
            isAvailable: false,
            sortOrder: 1,
          },
        ],
      },
    ],
  };

  it('joins catalog items with branch offerings, sorted by category then item', () => {
    const rows = buildStockRows(tree, [
      { menuItemId: 'item-burger', isAvailable: true },
      { menuItemId: 'item-side', isAvailable: false },
    ]);

    expect(rows.map((r) => r.menuItemId)).toEqual([
      'item-salad',
      'item-burger',
      'item-side',
    ]);
    expect(rows[0]).toMatchObject({
      name: 'Salad',
      categoryName: 'Mains',
      catalogAvailable: false,
      isOffered: false,
      inStock: false,
    });
    expect(rows[1]).toMatchObject({
      name: 'Burger',
      isOffered: true,
      inStock: true,
      priceCents: 1299,
      currency: 'USD',
    });
    expect(rows[2]).toMatchObject({
      name: 'Fries',
      categoryName: 'Sides',
      isOffered: true,
      inStock: false,
    });
  });

  it('treats missing offerings as not offered / out of stock', () => {
    const rows = buildStockRows(tree, []);
    expect(rows.every((r) => !r.isOffered && !r.inStock)).toBe(true);
  });
});
