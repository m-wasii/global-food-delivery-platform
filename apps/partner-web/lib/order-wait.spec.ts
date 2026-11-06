import { describe, expect, it } from 'vitest';
import { formatWaitAge, waitAnchorIso } from './order-wait';
import type { PartnerOrderSummary } from './types';

function order(
  overrides: Partial<PartnerOrderSummary> & Pick<PartnerOrderSummary, 'status'>,
): PartnerOrderSummary {
  return {
    id: 'o1',
    restaurantId: 'r1',
    restaurantBranchId: 'b1',
    restaurantName: 'Test',
    branchName: 'Main',
    fulfillmentType: 'DELIVERY',
    currency: 'USD',
    total: 1000,
    itemCount: 1,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
    isNew: overrides.status === 'PENDING',
    timing: {
      pendingAt: '2026-11-04T10:00:00.000Z',
      acceptedAt: null,
      preparingAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: null,
      rejectedAt: null,
    },
    ...overrides,
  };
}

describe('waitAnchorIso', () => {
  it('uses pending timing for new PENDING orders', () => {
    expect(
      waitAnchorIso(
        order({
          status: 'PENDING',
          timing: {
            pendingAt: '2026-11-04T10:00:00.000Z',
            acceptedAt: null,
            preparingAt: null,
            readyAt: null,
            completedAt: null,
            cancelledAt: null,
            rejectedAt: null,
          },
        }),
      ),
    ).toBe('2026-11-04T10:00:00.000Z');
  });

  it('uses status-entry timing for in-progress orders', () => {
    expect(
      waitAnchorIso(
        order({
          status: 'PREPARING',
          isNew: false,
          timing: {
            pendingAt: '2026-11-04T10:00:00.000Z',
            acceptedAt: '2026-11-04T10:01:00.000Z',
            preparingAt: '2026-11-04T10:05:00.000Z',
            readyAt: null,
            completedAt: null,
            cancelledAt: null,
            rejectedAt: null,
          },
        }),
      ),
    ).toBe('2026-11-04T10:05:00.000Z');
  });
});

describe('formatWaitAge', () => {
  it('formats seconds and minutes from the wait anchor', () => {
    const now = Date.parse('2026-11-04T10:02:30.000Z');
    expect(formatWaitAge('2026-11-04T10:02:00.000Z', now)).toBe('waiting 30s');
    expect(formatWaitAge('2026-11-04T10:00:00.000Z', now)).toBe('waiting 2m');
  });
});
