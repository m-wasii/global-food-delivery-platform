import { describe, expect, it } from 'vitest';
import { prepActionForStatus } from './prep-action';

describe('prepActionForStatus', () => {
  it('maps CONFIRMED → PREPARING (start preparing)', () => {
    expect(prepActionForStatus('CONFIRMED')).toEqual({
      toStatus: 'PREPARING',
      label: 'Start preparing',
      busyLabel: 'Starting…',
    });
  });

  it('maps PREPARING → READY (mark ready)', () => {
    expect(prepActionForStatus('PREPARING')).toEqual({
      toStatus: 'READY',
      label: 'Mark ready',
      busyLabel: 'Updating…',
    });
  });

  it('maps READY → COMPLETED (complete)', () => {
    expect(prepActionForStatus('READY')).toEqual({
      toStatus: 'COMPLETED',
      label: 'Complete',
      busyLabel: 'Completing…',
    });
  });

  it('returns null for statuses without a kitchen advance step', () => {
    expect(prepActionForStatus('PENDING')).toBeNull();
    expect(prepActionForStatus('COMPLETED')).toBeNull();
    expect(prepActionForStatus('CANCELLED')).toBeNull();
    expect(prepActionForStatus('REJECTED')).toBeNull();
  });
});
