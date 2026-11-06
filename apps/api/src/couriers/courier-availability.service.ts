import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import {
  canCourierGoOnline,
  canCourierReceiveOffers,
  type CourierCapabilityStatus,
  type CourierVehicleType,
} from './courier-profile';

const PROFILE_SELECT = {
  id: true,
  userId: true,
  status: true,
  phone: true,
  vehicleType: true,
  licenseNumber: true,
  operatingCityId: true,
  isOnline: true,
  onlineChangedAt: true,
} as const;

export interface CourierAvailabilitySnapshot {
  courierProfileId: string;
  isOnline: boolean;
  onlineChangedAt: string | null;
  canGoOnline: boolean;
  canReceiveOffers: boolean;
}

function toSnapshot(profile: {
  id: string;
  status: CourierCapabilityStatus;
  phone: string | null;
  vehicleType: CourierVehicleType | null;
  licenseNumber: string | null;
  operatingCityId: string | null;
  isOnline: boolean;
  onlineChangedAt: Date | null;
}): CourierAvailabilitySnapshot {
  const fields = {
    status: profile.status,
    phone: profile.phone,
    vehicleType: profile.vehicleType,
    licenseNumber: profile.licenseNumber,
    operatingCityId: profile.operatingCityId,
  };
  return {
    courierProfileId: profile.id,
    isOnline: profile.isOnline,
    onlineChangedAt: profile.onlineChangedAt?.toISOString() ?? null,
    canGoOnline: canCourierGoOnline(fields),
    canReceiveOffers: canCourierReceiveOffers({
      ...fields,
      isOnline: profile.isOnline,
    }),
  };
}

@Injectable()
export class CourierAvailabilityService {
  async getForUser(userId: string): Promise<CourierAvailabilitySnapshot> {
    const profile = await prisma.courierProfile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException('Courier profile not found');
    }
    return toSnapshot(profile);
  }

  async setForUser(
    userId: string,
    isOnline: boolean,
  ): Promise<CourierAvailabilitySnapshot> {
    const profile = await prisma.courierProfile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException('Courier profile not found');
    }

    const fields = {
      status: profile.status,
      phone: profile.phone,
      vehicleType: profile.vehicleType,
      licenseNumber: profile.licenseNumber,
      operatingCityId: profile.operatingCityId,
    };

    if (isOnline && !canCourierGoOnline(fields)) {
      throw new BadRequestException(
        'Courier must be ACTIVE with complete onboarding to go online',
      );
    }

    if (profile.isOnline === isOnline) {
      return toSnapshot(profile);
    }

    const updated = await prisma.courierProfile.update({
      where: { id: profile.id },
      data: {
        isOnline,
        onlineChangedAt: new Date(),
      },
      select: PROFILE_SELECT,
    });

    return toSnapshot(updated);
  }
}
