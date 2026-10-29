/**
 * Discovery already filters restaurants by delivery coverage for the browse pin.
 * Re-check radius at checkout only when the delivery address is not that same pin.
 */
export function shouldRecheckDeliveryRadius(params: {
  fulfillment: 'DELIVERY' | 'PICKUP';
  deliveryAddressId: string | null | undefined;
  discoveryAddressId: string | null | undefined;
}): boolean {
  if (params.fulfillment === 'PICKUP') return false;
  if (!params.deliveryAddressId) return true;
  if (
    params.discoveryAddressId &&
    params.discoveryAddressId === params.deliveryAddressId
  ) {
    return false;
  }
  return true;
}
