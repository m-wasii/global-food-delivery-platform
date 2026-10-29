import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { SetBranchMenuItemAvailabilityDto } from './dto/set-branch-menu-item-availability.dto';

@Injectable()
export class BranchMenuAvailabilityService {
  constructor(private readonly ownership: RestaurantOwnershipService) {}

  async listForBranch(userId: string, restaurantId: string, branchId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireBranch(restaurantId, branchId);

    const rows = await prisma.branchMenuItemAvailability.findMany({
      where: { branchId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            priceCents: true,
            currency: true,
            isAvailable: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      branchId,
      offerings: rows.map((row) => ({
        menuItemId: row.menuItemId,
        isAvailable: row.isAvailable,
        menuItem: row.menuItem,
        updatedAt: row.updatedAt,
      })),
    };
  }

  async upsert(
    userId: string,
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    dto: SetBranchMenuItemAvailabilityDto,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId, ['OWNER', 'STAFF']);
    await this.requireBranch(restaurantId, branchId);
    await this.requireMenuItemForRestaurant(restaurantId, menuItemId);

    const row = await prisma.branchMenuItemAvailability.upsert({
      where: { branchId_menuItemId: { branchId, menuItemId } },
      create: { branchId, menuItemId, isAvailable: dto.isAvailable },
      update: { isAvailable: dto.isAvailable },
    });

    return {
      branchId: row.branchId,
      menuItemId: row.menuItemId,
      isAvailable: row.isAvailable,
    };
  }

  async remove(userId: string, restaurantId: string, branchId: string, menuItemId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId, ['OWNER', 'STAFF']);
    await this.requireBranch(restaurantId, branchId);

    const existing = await prisma.branchMenuItemAvailability.findUnique({
      where: { branchId_menuItemId: { branchId, menuItemId } },
    });
    if (!existing) {
      throw new NotFoundException('Branch menu-item offering not found');
    }

    await prisma.branchMenuItemAvailability.delete({ where: { id: existing.id } });
    return { deleted: true as const, branchId, menuItemId };
  }

  private async requireBranch(restaurantId: string, branchId: string) {
    const branch = await prisma.restaurantBranch.findFirst({
      where: { id: branchId, restaurantId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  private async requireMenuItemForRestaurant(restaurantId: string, menuItemId: string) {
    const item = await prisma.menuItem.findFirst({
      where: {
        id: menuItemId,
        menuCategory: { menu: { restaurantId } },
      },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Menu item does not belong to this restaurant');
    }
    return item;
  }
}
