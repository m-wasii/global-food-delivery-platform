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
import { OrdersService } from '../orders/orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { shouldRecheckDeliveryRadius } from './checkout-radius';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly cartValidation: CartValidationService,
    private readonly ordersService: OrdersService,
  ) {}

  async preview(userId: string, restaurantId: string, dto: CheckoutDto) {
    const ctx = await this.prepareCheckout(userId, restaurantId, dto);
    return {
      restaurantId,
      selectedBranchId: ctx.cart.selectedBranchId,
      fulfillment: dto.fulfillment,
      deliveryAddressId: ctx.deliveryAddress?.id ?? null,
      radiusRechecked: ctx.radiusRechecked,
      pricing: ctx.pricing,
      canConfirm: true,
    };
  }

  async confirm(userId: string, restaurantId: string, dto: CheckoutDto) {
    const ctx = await this.prepareCheckout(userId, restaurantId, dto);

    const order = await this.ordersService.createFromCheckout({
      userId,
      restaurantId,
      cartId: ctx.cart.id,
      restaurantBranchId: ctx.cart.selectedBranchId,
      restaurantName: ctx.restaurantName,
      branchName: ctx.branchName,
      fulfillmentType: dto.fulfillment,
      deliveryAddress: ctx.deliveryAddress,
      pricing: ctx.pricing,
      menuById: ctx.menuById,
    });

    return {
      order,
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
            name: true,
            latitude: true,
            longitude: true,
            deliveryRadiusKm: true,
            restaurant: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    let deliveryAddress: {
      id: string;
      label: string | null;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      postalCode: string | null;
      country: string;
    } | null = null;
    let radiusRechecked = false;

    if (dto.fulfillment === 'DELIVERY') {
      deliveryAddress = await this.resolveDeliveryAddress(userId, dto.deliveryAddressId);

      const needsRadius = shouldRecheckDeliveryRadius({
        fulfillment: 'DELIVERY',
        deliveryAddressId: deliveryAddress.id,
        discoveryAddressId: dto.discoveryAddressId,
      });

      if (needsRadius) {
        radiusRechecked = true;
        await this.assertAddressInBranchRadius(cart.selectedBranch, deliveryAddress.id);
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
      deliveryAddress,
      radiusRechecked,
      pricing,
      menuById,
      restaurantName: cart.selectedBranch.restaurant.name,
      branchName: cart.selectedBranch.name,
    };
  }

  private async resolveDeliveryAddress(userId: string, addressId?: string) {
    const select = {
      id: true,
      label: true,
      line1: true,
      line2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
    } as const;

    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId, deletedAt: null },
        select,
      });
      if (!address) {
        throw new NotFoundException('Delivery address not found');
      }
      return address;
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
      select,
    });
    if (!stillActive) {
      throw new BadRequestException('Default delivery address is missing or deleted');
    }
    return stillActive;
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
