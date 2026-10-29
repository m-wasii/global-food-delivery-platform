import { describe, expect, it } from 'vitest';
import { isOfferedAtBranch, pickNearestCoveringBranch } from './preferred-branch';

describe('pickNearestCoveringBranch', () => {
  const customer = { lat: 31.52, lng: 74.35 };

  it('picks the nearest branch that covers the customer', () => {
    const result = pickNearestCoveringBranch(customer.lat, customer.lng, [
      {
        id: 'far',
        latitude: 31.6,
        longitude: 74.4,
        deliveryRadiusKm: 20,
      },
      {
        id: 'near',
        latitude: 31.525,
        longitude: 74.355,
        deliveryRadiusKm: 5,
      },
    ]);

    expect(result?.branchId).toBe('near');
    expect(result?.distanceKm).toBeLessThan(2);
  });

  it('ignores branches whose radius does not cover the customer', () => {
    const result = pickNearestCoveringBranch(customer.lat, customer.lng, [
      {
        id: 'too-small',
        latitude: 31.6,
        longitude: 74.45,
        deliveryRadiusKm: 0.5,
      },
    ]);
    expect(result).toBeNull();
  });
});

describe('isOfferedAtBranch', () => {
  it('requires an opt-in row with isAvailable true', () => {
    expect(isOfferedAtBranch(null)).toBe(false);
    expect(isOfferedAtBranch(undefined)).toBe(false);
    expect(isOfferedAtBranch({ isAvailable: false })).toBe(false);
    expect(isOfferedAtBranch({ isAvailable: true })).toBe(true);
  });
});
