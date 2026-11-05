import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from '../restaurants/restaurant-ownership.service';
import type { PriceBreakdown } from '../cart/pricing';
import {
  buildAddressSnapshot,
  buildOrderItemSnapshots,
  buildPricingSnapshot,
  type MenuItemSnapshotSource,
} from './order-creation';
import {
  formatCancelHistoryReason,
  isCustomerCancelWindowOpen,
  loadCustomerCancelWindowMs,
  type CancelReasonCode,
} from './cancellation';
import {
  actorMayRequestTransition,
  assertCanTransition,
  canTransition,
  type OrderStatusValue,
  type TransitionActorRole,
  allowedTargets,
} from './order-transitions';

export interface CreateOrderFromCheckoutInput {
  userId: string;
  restaurantId: string;
  cartId: string;
  restaurantBranchId: string;
  restaurantName: string;
  branchName: string;
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  deliveryAddress: {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
  } | null;
  pricing: PriceBreakdown;
  menuById: Map<string, MenuItemSnapshotSource>;
}

const PAST_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'] as const;

@Injectable()
export class OrdersService {
  constructor(private readonly ownership: RestaurantOwnershipService) {}

  /**
   * Customer order history: own orders only, newest first, thin pagination.
   */
  async listMyOrders(userId: string, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = { userId };
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: { select: { items: true } },
        },
      }),
    ]);

    const orders = rows.map((order) => ({
      id: order.id,
      status: order.status,
      restaurantName: order.restaurantName,
      branchName: order.branchName,
      fulfillmentType: order.fulfillmentType,
      currency: order.currency,
      total: order.totalCents,
      itemCount: order._count.items,
      createdAt: order.createdAt,
      isActive: !(PAST_STATUSES as readonly string[]).includes(order.status),
    }));

    return {
      orders,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.requireVisibleOrder(userId, orderId);
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    const role = await this.resolveActorRole(userId, {
      userId: order.userId,
      restaurantBranch: order.restaurantBranch,
    });
    return {
      ...this.serializeOrder(order),
      allowedTransitions: this.allowedTransitionsFor(
        role,
        order.status as OrderStatusValue,
        order.createdAt,
      ),
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
    opts: { cancelReason?: CancelReasonCode; reason?: string } = {},
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

    let historyReason: string | null = opts.reason?.trim() || null;
    if (toStatus === 'CANCELLED') {
      if (!opts.cancelReason) {
        throw new BadRequestException('cancelReason is required when cancelling');
      }
      if (
        role === 'customer' &&
        !isCustomerCancelWindowOpen(
          order.createdAt,
          new Date(),
          loadCustomerCancelWindowMs(),
        )
      ) {
        throw new BadRequestException(
          'Customer cancellation window has expired',
        );
      }
      historyReason = formatCancelHistoryReason(opts.cancelReason, opts.reason);
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
          reason: historyReason,
        },
      });
      return next;
    });

    return this.getOrder(userId, updated.id);
  }

  private allowedTransitionsFor(
    role: TransitionActorRole,
    status: OrderStatusValue,
    createdAt: Date,
  ): OrderStatusValue[] {
    let targets = allowedTargets(status).filter((to) =>
      actorMayRequestTransition(role, to),
    );
    if (
      role === 'customer' &&
      targets.includes('CANCELLED') &&
      !isCustomerCancelWindowOpen(createdAt, new Date(), loadCustomerCancelWindowMs())
    ) {
      targets = targets.filter((to) => to !== 'CANCELLED');
    }
    return [...targets];
  }

  /**
   * Persist an immutable order from a validated checkout context, then clear the cart.
   */
  async createFromCheckout(input: CreateOrderFromCheckoutInput) {
    const itemSnapshots = buildOrderItemSnapshots(input.pricing, input.menuById);
    const addressSnap = buildAddressSnapshot(input.deliveryAddress);
    const pricingSnap = buildPricingSnapshot(input.pricing);

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: input.userId,
          restaurantBranchId: input.restaurantBranchId,
          restaurantName: input.restaurantName,
          branchName: input.branchName,
          fulfillmentType: input.fulfillmentType,
          deliveryAddressId: addressSnap.deliveryAddressId,
          deliveryLabel: addressSnap.deliveryLabel,
          deliveryLine1: addressSnap.deliveryLine1,
          deliveryLine2: addressSnap.deliveryLine2,
          deliveryCity: addressSnap.deliveryCity,
          deliveryRegion: addressSnap.deliveryRegion,
          deliveryPostalCode: addressSnap.deliveryPostalCode,
          deliveryCountry: addressSnap.deliveryCountry,
          status: 'PENDING',
          ...pricingSnap,
          items: {
            create: itemSnapshots,
          },
        },
        include: {
          items: true,
          restaurantBranch: { select: { restaurantId: true, name: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'PENDING',
          actorUserId: input.userId,
          reason: 'created',
        },
      });

      await tx.cart.delete({ where: { id: input.cartId } });
      return order;
    });

    return this.serializeOrder(created);
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
    restaurantName?: string;
    branchName?: string;
    fulfillmentType: string;
    deliveryAddressId: string | null;
    deliveryLabel?: string | null;
    deliveryLine1?: string | null;
    deliveryLine2?: string | null;
    deliveryCity?: string | null;
    deliveryRegion?: string | null;
    deliveryPostalCode?: string | null;
    deliveryCountry?: string | null;
    status: string;
    currency: string;
    itemsSubtotalCents?: number;
    discountCents?: number;
    serviceFeeCents?: number;
    deliveryFeeCents?: number;
    taxCents?: number;
    taxRateBps?: number;
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
      restaurantName: order.restaurantName,
      branchName: order.branchName,
      fulfillmentType: order.fulfillmentType,
      deliveryAddressId: order.deliveryAddressId,
      deliveryAddress: order.deliveryLine1
        ? {
            label: order.deliveryLabel ?? null,
            line1: order.deliveryLine1,
            line2: order.deliveryLine2 ?? null,
            city: order.deliveryCity ?? null,
            region: order.deliveryRegion ?? null,
            postalCode: order.deliveryPostalCode ?? null,
            country: order.deliveryCountry ?? null,
          }
        : null,
      status: order.status,
      currency: order.currency,
      pricing: {
        itemsSubtotal: order.itemsSubtotalCents ?? order.totalCents,
        discount: order.discountCents ?? 0,
        serviceFee: order.serviceFeeCents ?? 0,
        deliveryFee: order.deliveryFeeCents ?? 0,
        tax: order.taxCents ?? 0,
        taxRateBps: order.taxRateBps ?? 0,
        total: order.totalCents,
      },
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
