/**
 * Courier profile + availability rules (EAT-51 / ADR 0021, EAT-52 / ADR 0022).
 * Capability status ≠ online/offline availability.
 */

export type CourierVehicleType = 'BICYCLE' | 'SCOOTER' | 'MOTORCYCLE' | 'CAR';
export type CourierCapabilityStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface CourierOnboardingFields {
  phone: string | null;
  vehicleType: CourierVehicleType | null;
  operatingCityId: string | null;
  licenseNumber: string | null;
}

export type CourierDispatchFields = CourierOnboardingFields & {
  status: CourierCapabilityStatus;
};

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
 * Platform-approved courier with a complete profile (employment / capability).
 * Does not consider live online/offline availability.
 */
export function isCourierDispatchEligible(
  fields: CourierDispatchFields,
): boolean {
  return fields.status === 'ACTIVE' && isCourierOnboardingComplete(fields);
}

/** Only dispatch-eligible couriers may flip to online. */
export function canCourierGoOnline(fields: CourierDispatchFields): boolean {
  return isCourierDispatchEligible(fields);
}

/**
 * Offer pool gate: eligible capability + currently online.
 * Location / capacity filters land in later dispatch issues.
 */
export function canCourierReceiveOffers(
  fields: CourierDispatchFields & { isOnline: boolean },
): boolean {
  return isCourierDispatchEligible(fields) && fields.isOnline;
}
