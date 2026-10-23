import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { haversineDistanceKm, isWithinDeliveryRadius } from './geo';
import { evaluateBranchAvailability } from './availability';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from './menus.service';

export interface DiscoverRestaurantsQuery {
  latitude?: number;
  longitude?: number;
  operatingCityId?: string;
  addressId?: string;
  userId?: string;
}

export interface DiscoveredRestaurant {
  id: string;
  name: string;
  slug: string;
  branch: {
    id: string;
    name: string;
    distanceKm: number;
    deliveryRadiusKm: number;
    operatingCity: { id: string; name: string; slug: string; country: string };
  };
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly menusService: MenusService,
  ) {}

  async getRestaurantDetail(slug: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        coverMedia: { select: { id: true, publicUrl: true, provider: true } },
      },
    });
    if (!restaurant || restaurant.status !== 'ACTIVE') {
      throw new NotFoundException('Restaurant not found');
    }

    const orderableBranches = await this.restaurantsService.listOrderableBranches({
      restaurantId: restaurant.id,
    });

    const branchesWithHours = orderableBranches.map((branch) => {
      const availability = evaluateBranchAvailability({
        temporarilyClosed: branch.temporarilyClosed,
        timezone: branch.timezone,
        weeklyHours: branch.weeklyHours,
        exceptions: branch.exceptions,
      });
      return {
        id: branch.id,
        name: branch.name,
        deliveryRadiusKm: Number(branch.deliveryRadiusKm),
        latitude: Number(branch.latitude),
        longitude: Number(branch.longitude),
        timezone: branch.timezone,
        temporarilyClosed: branch.temporarilyClosed,
        isOpen: availability.isOpen,
        availabilityReason: availability.reason,
        weeklyHours: branch.weeklyHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTimeMinutes: h.openTimeMinutes,
          closeTimeMinutes: h.closeTimeMinutes,
          isClosed: h.isClosed,
        })),
        operatingCity: {
          id: branch.operatingCity.id,
          name: branch.operatingCity.name,
          slug: branch.operatingCity.slug,
          country: branch.operatingCity.country,
        },
        address: {
          line1: branch.address.line1,
          line2: branch.address.line2,
          city: branch.address.city,
          region: branch.address.region,
          postalCode: branch.address.postalCode,
          country: branch.address.country,
        },
      };
    });

    let menu: Awaited<ReturnType<MenusService['getActiveMenuForRestaurant']>> | null =
      null;
    try {
      menu = await this.menusService.getActiveMenuForRestaurant(restaurant.id);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    const openBranches = branchesWithHours.filter((b) => b.isOpen);
    const isAcceptingOrders = openBranches.length > 0;

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: restaurant.status,
        coverImageUrl: restaurant.coverMedia?.publicUrl ?? null,
      },
      isAcceptingOrders,
      hours: branchesWithHours.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        timezone: b.timezone,
        isOpen: b.isOpen,
        reason: b.availabilityReason,
        weeklyHours: b.weeklyHours,
      })),
      branches: branchesWithHours,
      menu: menu
        ? {
            id: menu.id,
            name: menu.name,
            categories: menu.categories.map((category) => ({
              id: category.id,
              name: category.name,
              sortOrder: category.sortOrder,
              items: category.items.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                imageMediaId: item.imageMediaId,
                imageUrl: item.imageMedia?.publicUrl ?? null,
                priceCents: item.priceCents,
                currency: item.currency,
                sortOrder: item.sortOrder,
              })),
            })),
          }
        : null,
    };
  }

  async discoverRestaurants(query: DiscoverRestaurantsQuery): Promise<{
    restaurants: DiscoveredRestaurant[];
    location: { latitude: number; longitude: number; source: 'query' | 'address' };
  }> {
    const location = await this.resolveLocation(query);

    const branches = await this.restaurantsService.listOrderableBranches({
      operatingCityId: query.operatingCityId,
    });

    const matches: DiscoveredRestaurant[] = [];

    for (const branch of branches) {
      const availability = evaluateBranchAvailability({
        temporarilyClosed: branch.temporarilyClosed,
        timezone: branch.timezone,
        weeklyHours: branch.weeklyHours,
        exceptions: branch.exceptions,
      });
      if (!availability.isOpen) continue;

      const originLat = Number(branch.latitude);
      const originLng = Number(branch.longitude);
      const radiusKm = Number(branch.deliveryRadiusKm);

      if (
        !isWithinDeliveryRadius({
          originLat,
          originLng,
          pointLat: location.latitude,
          pointLng: location.longitude,
          radiusKm,
        })
      ) {
        continue;
      }

      const distanceKm = haversineDistanceKm(
        originLat,
        originLng,
        location.latitude,
        location.longitude,
      );

      matches.push({
        id: branch.restaurant.id,
        name: branch.restaurant.name,
        slug: branch.restaurant.slug,
        branch: {
          id: branch.id,
          name: branch.name,
          distanceKm: Math.round(distanceKm * 100) / 100,
          deliveryRadiusKm: radiusKm,
          operatingCity: {
            id: branch.operatingCity.id,
            name: branch.operatingCity.name,
            slug: branch.operatingCity.slug,
            country: branch.operatingCity.country,
          },
        },
      });
    }

    // One card per restaurant: keep the nearest orderable branch.
    const byRestaurant = new Map<string, DiscoveredRestaurant>();
    for (const match of matches) {
      const existing = byRestaurant.get(match.id);
      if (!existing || match.branch.distanceKm < existing.branch.distanceKm) {
        byRestaurant.set(match.id, match);
      }
    }

    const restaurants = [...byRestaurant.values()].sort(
      (a, b) => a.branch.distanceKm - b.branch.distanceKm,
    );

    return {
      restaurants,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
      },
    };
  }

  private async resolveLocation(query: DiscoverRestaurantsQuery): Promise<{
    latitude: number;
    longitude: number;
    source: 'query' | 'address';
  }> {
    if (query.addressId) {
      if (!query.userId) {
        throw new UnauthorizedException('Authentication required to use addressId');
      }
      const address = await prisma.address.findFirst({
        where: {
          id: query.addressId,
          userId: query.userId,
          deletedAt: null,
        },
      });
      if (!address) {
        throw new NotFoundException('Address not found');
      }
      if (address.latitude == null || address.longitude == null) {
        throw new BadRequestException(
          'Address is missing latitude/longitude; update the address pin before discovering',
        );
      }
      return {
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        source: 'address',
      };
    }

    if (query.latitude == null || query.longitude == null) {
      throw new BadRequestException(
        'Provide latitude and longitude, or an addressId with coordinates',
      );
    }

    return {
      latitude: query.latitude,
      longitude: query.longitude,
      source: 'query',
    };
  }
}
