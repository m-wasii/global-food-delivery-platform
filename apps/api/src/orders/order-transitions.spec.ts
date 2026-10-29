import { describe, expect, it } from 'vitest';
import {
  actorMayRequestTransition,
  assertCanTransition,
  canTransition,
  allowedTargets,
} from './order-transitions';

describe('order transitions', () => {
  it('allows the happy path', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'COMPLETED')).toBe(true);
  });

  it('rejects invalid and terminal moves', () => {
    expect(canTransition('PENDING', 'READY')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
    expect(() => assertCanTransition('READY', 'PREPARING')).toThrow(/Invalid/);
  });

  it('lists targets and actor permissions', () => {
    expect(allowedTargets('PENDING')).toEqual(
      expect.arrayContaining(['CONFIRMED', 'CANCELLED', 'REJECTED']),
    );
    expect(actorMayRequestTransition('customer', 'CANCELLED')).toBe(true);
    expect(actorMayRequestTransition('customer', 'CONFIRMED')).toBe(false);
    expect(actorMayRequestTransition('partner', 'CONFIRMED')).toBe(true);
    expect(actorMayRequestTransition('admin', 'COMPLETED')).toBe(true);
  });
});
