import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';

type MembershipRole = 'OWNER' | 'STAFF';

export interface RestaurantMembershipRecord {
  id: string;
  userId: string;
  restaurantId: string;
  role: MembershipRole;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
}

@Injectable()
export class RestaurantOwnershipService {
  async getActiveMembership(
    userId: string,
    restaurantId: string,
  ): Promise<RestaurantMembershipRecord | null> {
    return prisma.restaurantMembership.findFirst({
      where: { userId, restaurantId, status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        restaurantId: true,
        role: true,
        status: true,
      },
    });
  }

  /**
   * Enforces per-restaurant ownership (ADR 0003).
   * Partner capability alone is not enough — membership must match this restaurantId.
   */
  async assertOwner(userId: string, restaurantId: string): Promise<RestaurantMembershipRecord> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const membership = await this.getActiveMembership(userId, restaurantId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Restaurant owner access required');
    }
    return membership;
  }

  async assertActiveMember(
    userId: string,
    restaurantId: string,
    allowedRoles: MembershipRole[] = ['OWNER', 'STAFF'],
  ): Promise<RestaurantMembershipRecord> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const membership = await this.getActiveMembership(userId, restaurantId);
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Restaurant membership required');
    }
    return membership;
  }
}
