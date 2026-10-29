import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from '../restaurants/restaurant-ownership.service';
import {
  actorMayRequestTransition,
  assertCanTransition,
  canTransition,
  type OrderStatusValue,
  type TransitionActorRole,
  allowedTargets,
} from './order-transitions';

@Injectable()
export class OrdersService {
  constructor(private readonly ownership: RestaurantOwnershipService) {}

  async getOrder(userId: string, orderId: string) {
    const order = await this.requireVisibleOrder(userId, orderId);
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.serializeOrder(order),
      allowedTransitions: allowedTargets(order.status as OrderStatusValue),
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorUserId: h.actorUserId,
        reason: h.reason,
        createdAt: h.createdAt,
      })),
    };
  }

  async transition(
    userId: string,
    orderId: string,
    toStatus: OrderStatusValue,
    reason?: string,
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurantBranch: { select: { restaurantId: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const fromStatus = order.status as OrderStatusValue;
    if (!canTransition(fromStatus, toStatus)) {
      throw new BadRequestException(`Invalid order transition: ${fromStatus} → ${toStatus}`);
    }

    const role = await this.resolveActorRole(userId, order);
    if (!actorMayRequestTransition(role, toStatus)) {
      throw new ForbiddenException(
        `Role ${role} cannot transition an order to ${toStatus}`,
      );
    }

    // Customer cancel: only own order
    if (role === 'customer' && order.userId !== userId) {
      throw new ForbiddenException('Not your order');
    }

    // Partner: must be member of the restaurant
    if (role === 'partner') {
      await this.ownership.assertActiveMember(
        userId,
        order.restaurantBranch.restaurantId,
      );
    }

    assertCanTransition(fromStatus, toStatus);

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: orderId },
        data: { status: toStatus },
        include: {
          restaurantBranch: { select: { restaurantId: true } },
          items: true,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus,
          actorUserId: userId,
          reason: reason ?? null,
        },
      });
      return next;
    });

    return this.getOrder(userId, updated.id);
  }

  /**
   * Record the creation event (fromStatus null → PENDING). Used inside checkout tx.
   */
  async recordCreatedInTransaction(
    tx: Prisma.TransactionClient,
    params: { orderId: string; actorUserId: string; toStatus?: OrderStatusValue },
  ) {
    await tx.orderStatusHistory.create({
      data: {
        orderId: params.orderId,
        fromStatus: null,
        toStatus: params.toStatus ?? 'PENDING',
        actorUserId: params.actorUserId,
        reason: 'created',
      },
    });
  }

  private async resolveActorRole(
    userId: string,
    order: { userId: string; restaurantBranch: { restaurantId: string } },
  ): Promise<TransitionActorRole> {
    const admin = await prisma.adminGrant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (admin) return 'admin';

    const membership = await prisma.restaurantMembership.findFirst({
      where: {
        userId,
        restaurantId: order.restaurantBranch.restaurantId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (membership) return 'partner';

    if (order.userId === userId) return 'customer';

    throw new ForbiddenException('Not allowed to transition this order');
  }

  private async requireVisibleOrder(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurantBranch: { select: { restaurantId: true, name: true } },
        items: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId === userId) return order;

    const admin = await prisma.adminGrant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (admin) return order;

    const membership = await prisma.restaurantMembership.findFirst({
      where: {
        userId,
        restaurantId: order.restaurantBranch.restaurantId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (membership) return order;

    throw new ForbiddenException('Not allowed to view this order');
  }

  private serializeOrder(order: {
    id: string;
    userId: string;
    restaurantBranchId: string;
    fulfillmentType: string;
    deliveryAddressId: string | null;
    status: string;
    currency: string;
    totalCents: number;
    createdAt: Date;
    updatedAt: Date;
    restaurantBranch?: { restaurantId: string; name?: string };
    items: Array<{
      id: string;
      menuItemId: string | null;
      name: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }>;
  }) {
    return {
      id: order.id,
      userId: order.userId,
      restaurantBranchId: order.restaurantBranchId,
      restaurantId: order.restaurantBranch?.restaurantId,
      fulfillmentType: order.fulfillmentType,
      deliveryAddressId: order.deliveryAddressId,
      status: order.status,
      currency: order.currency,
      total: order.totalCents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
        lineTotal: item.lineTotalCents,
      })),
    };
  }
}
