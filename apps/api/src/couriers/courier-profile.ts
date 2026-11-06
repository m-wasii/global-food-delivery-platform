/**
 * Courier profile rules (EAT-51 / ADR 0021).
 * Capability status ≠ online/offline availability (EAT-52).
 */

export type CourierVehicleType = 'BICYCLE' | 'SCOOTER' | 'MOTORCYCLE' | 'CAR';
export type CourierCapabilityStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface CourierOnboardingFields {
  phone: string | null;
  vehicleType: CourierVehicleType | null;
  operatingCityId: string | null;
  licenseNumber: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Motorized vehicles need a license number before onboarding is complete. */
export function requiresLicenseNumber(
  vehicleType: CourierVehicleType | null,
): boolean {
  return (
    vehicleType === 'SCOOTER' ||
    vehicleType === 'MOTORCYCLE' ||
    vehicleType === 'CAR'
  );
}

/** Profile has the fields required to submit for platform review / activation. */
export function isCourierOnboardingComplete(
  fields: CourierOnboardingFields,
): boolean {
  if (!hasText(fields.phone)) return false;
  if (fields.vehicleType == null) return false;
  if (!hasText(fields.operatingCityId)) return false;
  if (requiresLicenseNumber(fields.vehicleType) && !hasText(fields.licenseNumber)) {
    return false;
  }
  return true;
}

/**
 * Platform-approved courier with a complete profile.
 * Online/offline gating is deferred to EAT-52.
 */
export function isCourierDispatchEligible(
  fields: CourierOnboardingFields & { status: CourierCapabilityStatus },
): boolean {
  return fields.status === 'ACTIVE' && isCourierOnboardingComplete(fields);
}
