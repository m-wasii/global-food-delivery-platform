const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance in kilometers between two WGS84 points. */
export function haversineDistanceKm(
  originLat: number,
  originLng: number,
  pointLat: number,
  pointLng: number,
): number {
  const dLat = toRadians(pointLat - originLat);
  const dLng = toRadians(pointLng - originLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(pointLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function isWithinDeliveryRadius(params: {
  originLat: number;
  originLng: number;
  pointLat: number;
  pointLng: number;
  radiusKm: number;
}): boolean {
  if (params.radiusKm < 0) return false;
  return (
    haversineDistanceKm(
      params.originLat,
      params.originLng,
      params.pointLat,
      params.pointLng,
    ) <= params.radiusKm
  );
}

/** Branch is orderable only when brand, city, status, and service area are complete. */
export function isBranchOrderable(params: {
  restaurantStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  branchStatus: 'INACTIVE' | 'ACTIVE';
  operatingCityIsActive: boolean;
  latitude: number | null;
  longitude: number | null;
  deliveryRadiusKm: number | null;
}): boolean {
  return (
    params.restaurantStatus === 'ACTIVE' &&
    params.branchStatus === 'ACTIVE' &&
    params.operatingCityIsActive &&
    params.latitude != null &&
    params.longitude != null &&
    params.deliveryRadiusKm != null &&
    params.deliveryRadiusKm > 0
  );
}
