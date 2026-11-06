import { describe, expect, it } from 'vitest';
import {
  isCourierDispatchEligible,
  isCourierOnboardingComplete,
  requiresLicenseNumber,
} from './courier-profile';

describe('isCourierOnboardingComplete', () => {
  it('requires phone, vehicle type, and home city before review', () => {
    expect(
      isCourierOnboardingComplete({
        phone: null,
        vehicleType: 'BICYCLE',
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierOnboardingComplete({
        phone: '  ',
        vehicleType: 'BICYCLE',
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: null,
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: 'BICYCLE',
        operatingCityId: null,
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: 'BICYCLE',
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(true);
  });

  it('requires a license number for motorized vehicles', () => {
    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: 'MOTORCYCLE',
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: 'MOTORCYCLE',
        operatingCityId: 'city-1',
        licenseNumber: 'LIC-123',
      }),
    ).toBe(true);

    expect(
      isCourierOnboardingComplete({
        phone: '+923001234567',
        vehicleType: 'CAR',
        operatingCityId: 'city-1',
        licenseNumber: '  ',
      }),
    ).toBe(false);
  });
});

describe('requiresLicenseNumber', () => {
  it('is true for scooter, motorcycle, and car', () => {
    expect(requiresLicenseNumber('BICYCLE')).toBe(false);
    expect(requiresLicenseNumber('SCOOTER')).toBe(true);
    expect(requiresLicenseNumber('MOTORCYCLE')).toBe(true);
    expect(requiresLicenseNumber('CAR')).toBe(true);
    expect(requiresLicenseNumber(null)).toBe(false);
  });
});

describe('isCourierDispatchEligible', () => {
  it('requires ACTIVE capability status plus a complete profile', () => {
    const complete = {
      phone: '+923001234567',
      vehicleType: 'BICYCLE' as const,
      operatingCityId: 'city-1',
      licenseNumber: null as string | null,
    };

    expect(
      isCourierDispatchEligible({
        status: 'PENDING',
        ...complete,
      }),
    ).toBe(false);

    expect(
      isCourierDispatchEligible({
        status: 'SUSPENDED',
        ...complete,
      }),
    ).toBe(false);

    expect(
      isCourierDispatchEligible({
        status: 'ACTIVE',
        phone: null,
        vehicleType: 'BICYCLE',
        operatingCityId: 'city-1',
        licenseNumber: null,
      }),
    ).toBe(false);

    expect(
      isCourierDispatchEligible({
        status: 'ACTIVE',
        ...complete,
      }),
    ).toBe(true);
  });
});
