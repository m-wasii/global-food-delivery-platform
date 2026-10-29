import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { pickNearestCoveringBranch } from './preferred-branch';

@Injectable()
export class PreferredBranchService {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  /**
   * On restaurant open: return sticky favored branch, or pick nearest covering
   * orderable branch from the user's default address and persist it.
   */
  async resolvePreferredBranch(userId: string, restaurantId: string) {
    await this.requireActiveRestaurant(restaurantId);

    const existing = await prisma.userRestaurantPreference.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });

    const customer = await this.requireCustomerPin(userId);
    const orderable = await this.loadCoveringCandidates(restaurantId);

    if (existing) {
      const favored = orderable.find((b) => b.id === existing.favoredBranchId);
      if (favored) {
        const covers = pickNearestCoveringBranch(customer.latitude, customer.longitude, [
          favored,
        ]);
        if (covers) {
          return {
            restaurantId,
            branchId: existing.favoredBranchId,
            branch: this.serializeBranch(favored),
            source: 'preference' as const,
            distanceKm: covers.distanceKm,
          };
        }
      }
    }

    const nearest = pickNearestCoveringBranch(
      customer.latitude,
      customer.longitude,
      orderable,
    );
    if (!nearest) {
      throw new BadRequestException(
        'No orderable branch covers your default delivery address for this restaurant',
      );
    }

    await prisma.userRestaurantPreference.upsert({
      where: { userId_restaurantId: { userId, restaurantId } },
      create: {
        userId,
        restaurantId,
        favoredBranchId: nearest.branchId,
      },
      update: { favoredBranchId: nearest.branchId },
    });

    const branch = orderable.find((b) => b.id === nearest.branchId)!;
    return {
      restaurantId,
      branchId: nearest.branchId,
      branch: this.serializeBranch(branch),
      source: existing ? ('nearest_reselected' as const) : ('nearest' as const),
      distanceKm: nearest.distanceKm,
    };
  }

  /** Explicit menu-header / checkout branch change — remember for next open. */
  async setPreferredBranch(userId: string, restaurantId: string, branchId: string) {
    await this.requireActiveRestaurant(restaurantId);

    const orderable = await this.restaurantsService.listOrderableBranches({ restaurantId });
    const match = orderable.find((b) => b.id === branchId);
    if (!match) {
      throw new BadRequestException(
        'Branch is not orderable for this restaurant (inactive, closed, or incomplete service area)',
      );
    }

    await prisma.userRestaurantPreference.upsert({
      where: { userId_restaurantId: { userId, restaurantId } },
      create: { userId, restaurantId, favoredBranchId: branchId },
      update: { favoredBranchId: branchId },
    });

    await prisma.cart.updateMany({
      where: { userId, restaurantId },
      data: { selectedBranchId: branchId },
    });

    return {
      restaurantId,
      branchId,
      branch: this.serializeBranch({
        id: match.id,
        name: match.name,
        latitude: Number(match.latitude),
        longitude: Number(match.longitude),
        deliveryRadiusKm: Number(match.deliveryRadiusKm),
      }),
      source: 'explicit' as const,
    };
  }

  async requirePreferredBranchId(userId: string, restaurantId: string): Promise<string> {
    const resolved = await this.resolvePreferredBranch(userId, restaurantId);
    return resolved.branchId;
  }

  private async requireActiveRestaurant(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, status: true },
    });
    if (!restaurant || restaurant.status !== 'ACTIVE') {
      throw new NotFoundException('Restaurant not found');
    }
    return restaurant;
  }

  private async requireCustomerPin(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultAddress: {
          select: { latitude: true, longitude: true, deletedAt: true },
        },
      },
    });
    const address = user?.defaultAddress;
    if (!address || address.deletedAt) {
      throw new BadRequestException(
        'Set a default delivery address with coordinates before selecting a branch',
      );
    }
    if (address.latitude == null || address.longitude == null) {
      throw new BadRequestException(
        'Default delivery address needs latitude and longitude to pick the nearest branch',
      );
    }
    return {
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
  }

  private async loadCoveringCandidates(restaurantId: string) {
    const branches = await this.restaurantsService.listOrderableBranches({ restaurantId });
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      deliveryRadiusKm: Number(b.deliveryRadiusKm),
    }));
  }

  private serializeBranch(branch: {
    id: string;
    name?: string;
    latitude: number;
    longitude: number;
    deliveryRadiusKm: number;
  }) {
    return {
      id: branch.id,
      name: branch.name ?? null,
      latitude: branch.latitude,
      longitude: branch.longitude,
      deliveryRadiusKm: branch.deliveryRadiusKm,
    };
  }
}
