import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateOperatingCityDto } from './dto/create-operating-city.dto';
import { slugifyName } from './slug';
import { isBranchOrderable } from './geo';
import { MediaService } from '../media/media.service';

const branchInclude = {
  address: true,
  operatingCity: true,
} as const;

function normalizeCuisineTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = tag.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly ownership: RestaurantOwnershipService,
    private readonly mediaService: MediaService,
  ) {}

  async createOperatingCity(dto: CreateOperatingCityDto) {
    const slug = dto.slug ?? slugifyName(dto.name);
    try {
      return await prisma.operatingCity.create({
        data: {
          name: dto.name,
          country: dto.country,
          slug,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Operating city slug already exists');
      }
      throw error;
    }
  }

  async listOperatingCities(activeOnly = true) {
    return prisma.operatingCity.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });
  }

  async createRestaurant(userId: string, dto: CreateRestaurantDto) {
    const baseSlug = dto.slug ?? slugifyName(dto.name);
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const slug = await this.allocateUniqueRestaurantSlug(baseSlug, tx);
          const restaurant = await tx.restaurant.create({
            data: {
              name: dto.name,
              slug,
              status: 'PENDING',
              cuisineTags: normalizeCuisineTags(dto.cuisineTags),
            },
          });

          await tx.restaurantMembership.create({
            data: {
              userId,
              restaurantId: restaurant.id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          });

          return restaurant;
        });
      } catch (error) {
        const isSlugConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (isSlugConflict && attempt < maxAttempts - 1) {
          continue;
        }
        if (isSlugConflict) {
          throw new ConflictException('Restaurant slug already exists');
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to allocate a unique restaurant slug');
  }

  async listMyRestaurants(userId: string) {
    const memberships = await prisma.restaurantMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { restaurant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      membership: { id: m.id, role: m.role, status: m.status },
      restaurant: m.restaurant,
    }));
  }

  async getRestaurantForMember(userId: string, restaurantId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        branches: { include: branchInclude, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return restaurant;
  }

  async updateRestaurant(userId: string, restaurantId: string, dto: UpdateRestaurantDto) {
    await this.ownership.assertOwner(userId, restaurantId);

    if (dto.slug) {
      const clash = await prisma.restaurant.findFirst({
        where: { slug: dto.slug, NOT: { id: restaurantId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('Restaurant slug already exists');
      }
    }

    if (dto.coverMediaId) {
      await this.mediaService.requireExisting(dto.coverMediaId);
    }

    try {
      return await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.cuisineTags !== undefined
            ? { cuisineTags: normalizeCuisineTags(dto.cuisineTags) }
            : {}),
          ...(dto.coverMediaId !== undefined ? { coverMediaId: dto.coverMediaId } : {}),
        },
        include: { coverMedia: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Restaurant slug already exists');
      }
      throw error;
    }
  }

  async activateRestaurant(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    if (restaurant.status === 'ACTIVE') {
      return restaurant;
    }
    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'ACTIVE' },
    });
  }

  async suspendRestaurant(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: { status: 'SUSPENDED' },
    });
  }

  async createBranch(userId: string, restaurantId: string, dto: CreateBranchDto) {
    await this.ownership.assertOwner(userId, restaurantId);
    await this.requireActiveOperatingCity(dto.operatingCityId);

    return prisma.$transaction(async (tx) => {
      const address = await tx.address.create({
        data: {
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          region: dto.region,
          postalCode: dto.postalCode,
          country: dto.country,
          latitude: dto.latitude != null ? new Prisma.Decimal(dto.latitude) : undefined,
          longitude: dto.longitude != null ? new Prisma.Decimal(dto.longitude) : undefined,
        },
      });

      return tx.restaurantBranch.create({
        data: {
          restaurantId,
          addressId: address.id,
          operatingCityId: dto.operatingCityId,
          name: dto.name,
          status: 'INACTIVE',
          latitude: dto.latitude != null ? new Prisma.Decimal(dto.latitude) : undefined,
          longitude: dto.longitude != null ? new Prisma.Decimal(dto.longitude) : undefined,
          deliveryRadiusKm:
            dto.deliveryRadiusKm != null ? new Prisma.Decimal(dto.deliveryRadiusKm) : undefined,
          ...(dto.minimumOrderCents !== undefined
            ? { minimumOrderCents: dto.minimumOrderCents }
            : {}),
        },
        include: branchInclude,
      });
    });
  }

  async listBranches(userId: string, restaurantId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    return prisma.restaurantBranch.findMany({
      where: { restaurantId },
      include: branchInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateBranch(
    userId: string,
    restaurantId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    await this.ownership.assertOwner(userId, restaurantId);
    const branch = await this.requireBranch(restaurantId, branchId);

    if (dto.operatingCityId) {
      await this.requireActiveOperatingCity(dto.operatingCityId);
    }

    const addressPatch = {
      ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
      ...(dto.line2 !== undefined ? { line2: dto.line2 } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.latitude !== undefined ? { latitude: new Prisma.Decimal(dto.latitude) } : {}),
      ...(dto.longitude !== undefined ? { longitude: new Prisma.Decimal(dto.longitude) } : {}),
    };

    return prisma.$transaction(async (tx) => {
      if (Object.keys(addressPatch).length > 0) {
        await tx.address.update({
          where: { id: branch.addressId },
          data: addressPatch,
        });
      }

      return tx.restaurantBranch.update({
        where: { id: branchId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.operatingCityId !== undefined
            ? { operatingCityId: dto.operatingCityId }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: new Prisma.Decimal(dto.latitude) } : {}),
          ...(dto.longitude !== undefined
            ? { longitude: new Prisma.Decimal(dto.longitude) }
            : {}),
          ...(dto.deliveryRadiusKm !== undefined
            ? { deliveryRadiusKm: new Prisma.Decimal(dto.deliveryRadiusKm) }
            : {}),
          ...(dto.temporarilyClosed !== undefined
            ? { temporarilyClosed: dto.temporarilyClosed }
            : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          ...(dto.minimumOrderCents !== undefined
            ? { minimumOrderCents: dto.minimumOrderCents }
            : {}),
        },
        include: branchInclude,
      });
    });
  }

  async activateBranch(userId: string, restaurantId: string, branchId: string) {
    await this.ownership.assertOwner(userId, restaurantId);
    const branch = await prisma.restaurantBranch.findFirst({
      where: { id: branchId, restaurantId },
      include: { restaurant: true, operatingCity: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const latitude = branch.latitude != null ? Number(branch.latitude) : null;
    const longitude = branch.longitude != null ? Number(branch.longitude) : null;
    const deliveryRadiusKm =
      branch.deliveryRadiusKm != null ? Number(branch.deliveryRadiusKm) : null;

    if (
      !isBranchOrderable({
        restaurantStatus: branch.restaurant.status,
        branchStatus: 'ACTIVE',
        operatingCityIsActive: branch.operatingCity.isActive,
        temporarilyClosed: branch.temporarilyClosed,
        latitude,
        longitude,
        deliveryRadiusKm,
      })
    ) {
      throw new BadRequestException(
        'Branch cannot be activated until the restaurant is ACTIVE, the operating city is active, and latitude, longitude, and deliveryRadiusKm are set',
      );
    }

    return prisma.restaurantBranch.update({
      where: { id: branchId },
      data: { status: 'ACTIVE' },
      include: branchInclude,
    });
  }

  async deactivateBranch(userId: string, restaurantId: string, branchId: string) {
    await this.ownership.assertOwner(userId, restaurantId);
    await this.requireBranch(restaurantId, branchId);

    return prisma.restaurantBranch.update({
      where: { id: branchId },
      data: { status: 'INACTIVE' },
      include: branchInclude,
    });
  }

  /**
   * Ordering/discovery must use this filter so inactive (or incomplete) branches never appear.
   */
  orderableBranchWhere(extra?: {
    operatingCityId?: string;
    restaurantId?: string;
  }): Prisma.RestaurantBranchWhereInput {
    return {
      status: 'ACTIVE',
      temporarilyClosed: false,
      latitude: { not: null },
      longitude: { not: null },
      deliveryRadiusKm: { not: null, gt: 0 },
      restaurant: {
        status: 'ACTIVE',
        ...(extra?.restaurantId ? { id: extra.restaurantId } : {}),
      },
      operatingCity: {
        isActive: true,
        ...(extra?.operatingCityId ? { id: extra.operatingCityId } : {}),
      },
    };
  }

  async listOrderableBranches(extra?: {
    operatingCityId?: string;
    restaurantId?: string;
  }) {
    return prisma.restaurantBranch.findMany({
      where: this.orderableBranchWhere(extra),
      include: {
        address: true,
        operatingCity: true,
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
        weeklyHours: true,
        exceptions: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private async requireBranch(restaurantId: string, branchId: string) {
    const branch = await prisma.restaurantBranch.findFirst({
      where: { id: branchId, restaurantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async requireActiveOperatingCity(operatingCityId: string) {
    const city = await prisma.operatingCity.findUnique({ where: { id: operatingCityId } });
    if (!city) {
      throw new NotFoundException('Operating city not found');
    }
    if (!city.isActive) {
      throw new BadRequestException('Operating city is not active');
    }
    return city;
  }

  private async allocateUniqueRestaurantSlug(
    base: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    const existing = await db.restaurant.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    if (!existing) return base;

    for (let i = 2; i < 1000; i++) {
      const candidate = `${base.slice(0, 70)}-${i}`;
      const clash = await db.restaurant.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new ConflictException('Unable to allocate a unique restaurant slug');
  }
}
