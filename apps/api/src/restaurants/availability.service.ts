import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { SetWeeklyHoursDto } from './dto/set-weekly-hours.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import {
  evaluateBranchAvailability,
  isMenuItemOrderable,
} from './availability';

@Injectable()
export class AvailabilityService {
  constructor(private readonly ownership: RestaurantOwnershipService) {}

  async getBranchAvailability(userId: string, restaurantId: string, branchId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    const branch = await this.requireBranch(restaurantId, branchId);
    const evaluation = evaluateBranchAvailability({
      temporarilyClosed: branch.temporarilyClosed,
      timezone: branch.timezone,
      weeklyHours: branch.weeklyHours,
      exceptions: branch.exceptions,
    });
    return {
      branchId: branch.id,
      temporarilyClosed: branch.temporarilyClosed,
      timezone: branch.timezone,
      weeklyHours: branch.weeklyHours,
      exceptions: branch.exceptions,
      now: evaluation,
    };
  }

  async setWeeklyHours(
    userId: string,
    restaurantId: string,
    branchId: string,
    dto: SetWeeklyHoursDto,
  ) {
    await this.ownership.assertOwner(userId, restaurantId);
    await this.requireBranch(restaurantId, branchId);

    const days = new Set<number>();
    for (const entry of dto.hours) {
      if (days.has(entry.dayOfWeek)) {
        throw new BadRequestException('Duplicate dayOfWeek in weekly hours');
      }
      days.add(entry.dayOfWeek);
      if (!entry.isClosed && entry.openTimeMinutes === entry.closeTimeMinutes) {
        throw new BadRequestException(
          'openTimeMinutes and closeTimeMinutes must differ when open',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.branchWeeklyHours.deleteMany({ where: { branchId } });
      await tx.branchWeeklyHours.createMany({
        data: dto.hours.map((entry) => ({
          branchId,
          dayOfWeek: entry.dayOfWeek,
          openTimeMinutes: entry.openTimeMinutes,
          closeTimeMinutes: entry.closeTimeMinutes,
          isClosed: entry.isClosed,
        })),
      });
    });

    return this.getBranchAvailability(userId, restaurantId, branchId);
  }

  async createException(
    userId: string,
    restaurantId: string,
    branchId: string,
    dto: CreateAvailabilityExceptionDto,
  ) {
    await this.ownership.assertOwner(userId, restaurantId);
    await this.requireBranch(restaurantId, branchId);

    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }
    if (
      !dto.isClosed &&
      (dto.openTimeMinutes == null || dto.closeTimeMinutes == null)
    ) {
      throw new BadRequestException(
        'openTimeMinutes and closeTimeMinutes are required when isClosed is false',
      );
    }
    if (
      !dto.isClosed &&
      dto.openTimeMinutes != null &&
      dto.closeTimeMinutes != null &&
      dto.openTimeMinutes === dto.closeTimeMinutes
    ) {
      throw new BadRequestException(
        'openTimeMinutes and closeTimeMinutes must differ when open',
      );
    }

    return prisma.branchAvailabilityException.create({
      data: {
        branchId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isClosed: dto.isClosed,
        openTimeMinutes: dto.isClosed ? null : dto.openTimeMinutes,
        closeTimeMinutes: dto.isClosed ? null : dto.closeTimeMinutes,
        reason: dto.reason,
      },
    });
  }

  async deleteException(
    userId: string,
    restaurantId: string,
    branchId: string,
    exceptionId: string,
  ) {
    await this.ownership.assertOwner(userId, restaurantId);
    await this.requireBranch(restaurantId, branchId);
    const exception = await prisma.branchAvailabilityException.findFirst({
      where: { id: exceptionId, branchId },
    });
    if (!exception) {
      throw new NotFoundException('Availability exception not found');
    }
    await prisma.branchAvailabilityException.delete({ where: { id: exceptionId } });
    return { id: exceptionId };
  }

  /**
   * Server-side gate for future checkout (EAT-34+).
   * Blocks ordering when branch is closed or item is unavailable.
   */
  async assertCanOrderItem(branchId: string, menuItemId: string, now = new Date()) {
    const branch = await prisma.restaurantBranch.findUnique({
      where: { id: branchId },
      include: {
        restaurant: true,
        operatingCity: true,
        weeklyHours: true,
        exceptions: true,
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const structural =
      branch.restaurant.status === 'ACTIVE' &&
      branch.status === 'ACTIVE' &&
      branch.operatingCity.isActive &&
      !branch.temporarilyClosed;

    if (!structural) {
      throw new BadRequestException('Branch is not available for ordering');
    }

    const hours = evaluateBranchAvailability({
      temporarilyClosed: branch.temporarilyClosed,
      timezone: branch.timezone,
      weeklyHours: branch.weeklyHours,
      exceptions: branch.exceptions,
    });
    if (!hours.isOpen) {
      throw new BadRequestException(`Branch is not open (${hours.reason})`);
    }

    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        menuCategory: {
          include: { menu: true },
        },
      },
    });
    if (!item || item.menuCategory.menu.restaurantId !== branch.restaurantId) {
      throw new NotFoundException('Menu item not found for this restaurant');
    }
    if (
      !isMenuItemOrderable({
        isAvailable: item.isAvailable,
        menuIsActive: item.menuCategory.menu.isActive,
      })
    ) {
      throw new BadRequestException('Menu item is unavailable');
    }

    const branchOffer = await prisma.branchMenuItemAvailability.findUnique({
      where: { branchId_menuItemId: { branchId, menuItemId } },
    });
    if (!branchOffer) {
      throw new BadRequestException('Menu item is not offered at this branch');
    }
    if (!branchOffer.isAvailable) {
      throw new BadRequestException('Menu item is out of stock at this branch');
    }

    return { branchId, menuItemId, reason: hours.reason };
  }

  private async requireBranch(restaurantId: string, branchId: string) {
    const branch = await prisma.restaurantBranch.findFirst({
      where: { id: branchId, restaurantId },
      include: {
        weeklyHours: { orderBy: { dayOfWeek: 'asc' } },
        exceptions: { orderBy: { startDate: 'asc' } },
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }
}
