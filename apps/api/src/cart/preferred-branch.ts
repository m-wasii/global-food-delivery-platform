import { haversineDistanceKm, isWithinDeliveryRadius } from '../restaurants/geo';

export interface BranchDistanceCandidate {
  id: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
}

/**
 * Among covering branches, pick the nearest to the customer pin.
 * Returns null when none cover the point.
 */
export function pickNearestCoveringBranch(
  customerLat: number,
  customerLng: number,
  branches: BranchDistanceCandidate[],
): { branchId: string; distanceKm: number } | null {
  let best: { branchId: string; distanceKm: number } | null = null;

  for (const branch of branches) {
    if (
      !isWithinDeliveryRadius({
        originLat: branch.latitude,
        originLng: branch.longitude,
        pointLat: customerLat,
        pointLng: customerLng,
        radiusKm: branch.deliveryRadiusKm,
      })
    ) {
      continue;
    }

    const distanceKm = haversineDistanceKm(
      branch.latitude,
      branch.longitude,
      customerLat,
      customerLng,
    );

    if (!best || distanceKm < best.distanceKm) {
      best = { branchId: branch.id, distanceKm };
    }
  }

  return best;
}

/** Opt-in branch offer: row must exist and be available. */
export function isOfferedAtBranch(availability: { isAvailable: boolean } | null | undefined): boolean {
  return availability?.isAvailable === true;
}
