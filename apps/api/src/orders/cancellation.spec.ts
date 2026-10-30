import { describe, expect, it } from 'vitest';
import {
  formatCancelHistoryReason,
  isCustomerCancelWindowOpen,
  loadCustomerCancelWindowMs,
} from './cancellation';

describe('cancellation window', () => {
  const createdAt = new Date('2026-10-30T00:00:00.000Z');
  const sevenMin = 7 * 60_000;

  it('allows cancel inside the window', () => {
    expect(
      isCustomerCancelWindowOpen(
        createdAt,
        new Date('2026-10-30T00:06:59.000Z'),
        sevenMin,
      ),
    ).toBe(true);
  });

  it('blocks cancel after the window', () => {
    expect(
      isCustomerCancelWindowOpen(
        createdAt,
        new Date('2026-10-30T00:07:01.000Z'),
        sevenMin,
      ),
    ).toBe(false);
  });

  it('defaults CUSTOMER_CANCEL_WINDOW_MINUTES to 7', () => {
    const prev = process.env.CUSTOMER_CANCEL_WINDOW_MINUTES;
    delete process.env.CUSTOMER_CANCEL_WINDOW_MINUTES;
    try {
      expect(loadCustomerCancelWindowMs()).toBe(7 * 60_000);
    } finally {
      if (prev === undefined) delete process.env.CUSTOMER_CANCEL_WINDOW_MINUTES;
      else process.env.CUSTOMER_CANCEL_WINDOW_MINUTES = prev;
    }
  });
});

describe('formatCancelHistoryReason', () => {
  it('stores code alone or with optional note', () => {
    expect(formatCancelHistoryReason('CHANGED_MIND')).toBe('CHANGED_MIND');
    expect(formatCancelHistoryReason('OTHER', '  allergy  ')).toBe(
      'OTHER: allergy',
    );
  });
});
