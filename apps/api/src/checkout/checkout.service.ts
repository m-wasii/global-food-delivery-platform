import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { CartValidationService } from '../cart/cart-validation.service';
import { loadPricingDefaults } from '../cart/pricing-config';
import { priceCart } from '../cart/pricing';
import { isWithinDeliveryRadius } from '../restaurants/geo';
import { CheckoutDto } from './dto/checkout.dto';
import { shouldRecheckDeliveryRadius } from './checkout-radius';

@Injectable()
export class CheckoutService {
  constructor(private readonly cartValidation: CartValidationService) {}

  async preview(userId: string, restaurantId: string, dto: CheckoutDto) {
    const ctx = await this.prepareCheckout(userId, restaurantId, dto);
    return {
      restaurantId,
      selectedBranchId: ctx.cart.selectedBranchId,
      fulfillment: dto.fulfillment,
      deliveryAddressId: ctx.deliveryAddressId,
      radiusRechecked: ctx.radiusRechecked,
      pricing: ctx.pricing,
      canConfirm: true,
    };
  }

  async confirm(userId: string, restaurantId: string, dto: CheckoutDto) {
    const ctx = await this.prepareCheckout(userId, restaurantId, dto);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          restaurantBranchId: ctx.cart.selectedBranchId,
          fulfillmentType: dto.fulfillment,
          deliveryAddressId: ctx.deliveryAddressId,
          status: 'PENDING',
          currency: ctx.pricing.currency,
          totalCents: ctx.pricing.total,
          items: {
            create: ctx.pricing.lines.map((line) => {
              const menuItem = ctx.menuById.get(line.menuItemId);
              return {
                menuItemId: line.menuItemId,
                name: menuItem?.name ?? 'Item',
                unitPriceCents: line.unitPrice,
                quantity: line.quantity,
                lineTotalCents: line.lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      await tx.cart.delete({ where: { id: ctx.cart.id } });
      return created;
    });

    return {
      order: {
        id: order.id,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        restaurantBranchId: order.restaurantBranchId,
        deliveryAddressId: order.deliveryAddressId,
        currency: order.currency,
        total: order.totalCents,
        items: order.items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPriceCents,
          lineTotal: item.lineTotalCents,
        })),
      },
      pricing: ctx.pricing,
    };
  }

  private async prepareCheckout(userId: string, restaurantId: string, dto: CheckoutDto) {
    await this.cartValidation.assertValidForCheckout(userId, restaurantId);

    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, priceCents: true, currency: true },
            },
          },
        },
        selectedBranch: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            deliveryRadiusKm: true,
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    let deliveryAddressId: string | null = null;
    let radiusRechecked = false;

    if (dto.fulfillment === 'DELIVERY') {
      deliveryAddressId = await this.resolveDeliveryAddressId(
        userId,
        dto.deliveryAddressId,
      );

      const needsRadius = shouldRecheckDeliveryRadius({
        fulfillment: 'DELIVERY',
        deliveryAddressId,
        discoveryAddressId: dto.discoveryAddressId,
      });

      if (needsRadius) {
        radiusRechecked = true;
        await this.assertAddressInBranchRadius(cart.selectedBranch, deliveryAddressId);
      }
    }

    const defaults = loadPricingDefaults();
    const pricing = priceCart({
      currency: cart.currency,
      lines: cart.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.menuItem.priceCents,
      })),
      serviceFee: defaults.serviceFee,
      deliveryFee: dto.fulfillment === 'PICKUP' ? 0 : defaults.deliveryFee,
      taxRateBps: defaults.taxRateBps,
    });

    const menuById = new Map(
      cart.items.map((item) => [item.menuItemId, item.menuItem] as const),
    );

    return {
      cart,
      deliveryAddressId,
      radiusRechecked,
      pricing,
      menuById,
    };
  }

  private async resolveDeliveryAddressId(userId: string, addressId?: string) {
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!address) {
        throw new NotFoundException('Delivery address not found');
      }
      return address.id;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultAddressId: true },
    });
    if (!user?.defaultAddressId) {
      throw new BadRequestException(
        'deliveryAddressId is required when no default address is set',
      );
    }

    const stillActive = await prisma.address.findFirst({
      where: { id: user.defaultAddressId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!stillActive) {
      throw new BadRequestException('Default delivery address is missing or deleted');
    }
    return stillActive.id;
  }

  private async assertAddressInBranchRadius(
    branch: {
      id: string;
      latitude: { toString(): string } | number | null;
      longitude: { toString(): string } | number | null;
      deliveryRadiusKm: { toString(): string } | number | null;
    },
    addressId: string,
  ) {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      select: { latitude: true, longitude: true },
    });
    if (!address || address.latitude == null || address.longitude == null) {
      throw new BadRequestException(
        'Delivery address needs coordinates to verify service area',
      );
    }
    if (
      branch.latitude == null ||
      branch.longitude == null ||
      branch.deliveryRadiusKm == null
    ) {
      throw new BadRequestException('Selected branch has incomplete service area');
    }

    const inRange = isWithinDeliveryRadius({
      originLat: Number(branch.latitude),
      originLng: Number(branch.longitude),
      pointLat: Number(address.latitude),
      pointLng: Number(address.longitude),
      radiusKm: Number(branch.deliveryRadiusKm),
    });
    if (!inRange) {
      throw new ForbiddenException(
        'Selected delivery address is outside this branch delivery radius',
      );
    }
  }
}
