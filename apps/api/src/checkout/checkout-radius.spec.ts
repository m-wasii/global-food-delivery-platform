import { describe, expect, it } from 'vitest';
import { shouldRecheckDeliveryRadius } from './checkout-radius';

describe('shouldRecheckDeliveryRadius', () => {
  it('skips for pickup', () => {
    expect(
      shouldRecheckDeliveryRadius({
        fulfillment: 'PICKUP',
        deliveryAddressId: 'a1',
        discoveryAddressId: 'a2',
      }),
    ).toBe(false);
  });

  it('skips when delivery address matches discovery address', () => {
    expect(
      shouldRecheckDeliveryRadius({
        fulfillment: 'DELIVERY',
        deliveryAddressId: 'a1',
        discoveryAddressId: 'a1',
      }),
    ).toBe(false);
  });

  it('rechecks when address changed or discovery context missing', () => {
    expect(
      shouldRecheckDeliveryRadius({
        fulfillment: 'DELIVERY',
        deliveryAddressId: 'a2',
        discoveryAddressId: 'a1',
      }),
    ).toBe(true);
    expect(
      shouldRecheckDeliveryRadius({
        fulfillment: 'DELIVERY',
        deliveryAddressId: 'a1',
        discoveryAddressId: undefined,
      }),
    ).toBe(true);
  });
});
