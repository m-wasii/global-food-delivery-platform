import { describe, expect, it } from 'vitest';
import {
  deriveKitchenTiming,
  isNewPartnerOrder,
  orderTimingFields,
} from './kitchen-timing';

describe('orderTimingFields', () => {
  it('exposes accept, prep start, ready, and rejection timestamps for analytics', () => {
    const fields = orderTimingFields([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'CONFIRMED', createdAt: new Date('2026-11-04T10:01:00.000Z') },
      { toStatus: 'PREPARING', createdAt: new Date('2026-11-04T10:05:00.000Z') },
      { toStatus: 'READY', createdAt: new Date('2026-11-04T10:20:00.000Z') },
    ]);

    expect(fields.timing.acceptedAt).toBe('2026-11-04T10:01:00.000Z');
    expect(fields.timing.preparingAt).toBe('2026-11-04T10:05:00.000Z');
    expect(fields.timing.readyAt).toBe('2026-11-04T10:20:00.000Z');
    expect(fields.timing.rejectedAt).toBeNull();
  });

  it('records rejection timestamp when the order was rejected', () => {
    const fields = orderTimingFields([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'REJECTED', createdAt: new Date('2026-11-04T10:02:00.000Z') },
    ]);

    expect(fields.timing.rejectedAt).toBe('2026-11-04T10:02:00.000Z');
    expect(fields.timing.acceptedAt).toBeNull();
  });
});

describe('deriveKitchenTiming', () => {
  it('maps first transition to each status as ISO timestamps', () => {
    const timing = deriveKitchenTiming([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'CONFIRMED', createdAt: new Date('2026-11-04T10:01:00.000Z') },
      { toStatus: 'PREPARING', createdAt: new Date('2026-11-04T10:05:00.000Z') },
      { toStatus: 'READY', createdAt: new Date('2026-11-04T10:20:00.000Z') },
      { toStatus: 'COMPLETED', createdAt: new Date('2026-11-04T10:45:00.000Z') },
    ]);

    expect(timing).toEqual({
      pendingAt: '2026-11-04T10:00:00.000Z',
      acceptedAt: '2026-11-04T10:01:00.000Z',
      preparingAt: '2026-11-04T10:05:00.000Z',
      readyAt: '2026-11-04T10:20:00.000Z',
      completedAt: '2026-11-04T10:45:00.000Z',
      cancelledAt: null,
      rejectedAt: null,
    });
  });

  it('keeps the first occurrence when a status appears twice', () => {
    const timing = deriveKitchenTiming([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'CONFIRMED', createdAt: new Date('2026-11-04T10:01:00.000Z') },
      // Defensive: history should not re-enter CONFIRMED, but first wins.
      { toStatus: 'CONFIRMED', createdAt: new Date('2026-11-04T10:02:00.000Z') },
      { toStatus: 'REJECTED', createdAt: new Date('2026-11-04T09:59:00.000Z') },
    ]);

    expect(timing.acceptedAt).toBe('2026-11-04T10:01:00.000Z');
    expect(timing.rejectedAt).toBe('2026-11-04T09:59:00.000Z');
  });

  it('returns nulls when history is empty', () => {
    expect(deriveKitchenTiming([])).toEqual({
      pendingAt: null,
      acceptedAt: null,
      preparingAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: null,
      rejectedAt: null,
    });
  });

  it('records cancel and reject paths', () => {
    const cancelled = deriveKitchenTiming([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'CANCELLED', createdAt: new Date('2026-11-04T10:03:00.000Z') },
    ]);
    expect(cancelled.cancelledAt).toBe('2026-11-04T10:03:00.000Z');
    expect(cancelled.rejectedAt).toBeNull();

    const rejected = deriveKitchenTiming([
      { toStatus: 'PENDING', createdAt: new Date('2026-11-04T10:00:00.000Z') },
      { toStatus: 'REJECTED', createdAt: new Date('2026-11-04T10:02:00.000Z') },
    ]);
    expect(rejected.rejectedAt).toBe('2026-11-04T10:02:00.000Z');
  });
});

describe('isNewPartnerOrder', () => {
  it('treats only PENDING as new for the incoming queue', () => {
    expect(isNewPartnerOrder('PENDING')).toBe(true);
    expect(isNewPartnerOrder('CONFIRMED')).toBe(false);
    expect(isNewPartnerOrder('PREPARING')).toBe(false);
    expect(isNewPartnerOrder('REJECTED')).toBe(false);
  });
});
