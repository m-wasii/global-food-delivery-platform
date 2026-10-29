import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { PreferredBranchService } from './preferred-branch.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { isOfferedAtBranch } from './preferred-branch';

@Injectable()
export class CartService {
  constructor(private readonly preferredBranchService: PreferredBranchService) {}

  async listActiveCarts(userId: string) {
    const carts = await prisma.cart.findMany({
      where: {
        userId,
        items: { some: {} },
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    return { carts: carts.map((cart) => this.toCartResponse(cart)) };
  }

  async getCart(userId: string, restaurantId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: this.cartInclude(),
    });
    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }
    return this.toCartResponse(cart);
  }

  async addItem(userId: string, restaurantId: string, dto: AddCartItemDto) {
    const menuItem = await this.requireMenuItemForRestaurant(restaurantId, dto.menuItemId);
    const branchId = await this.ensureCartBranch(userId, restaurantId);
    await this.assertOfferedAtBranch(branchId, dto.menuItemId);

    const cart = await prisma.$transaction(async (tx) => {
      const existing = await tx.cart.findUnique({
        where: { userId_restaurantId: { userId, restaurantId } },
      });

      const cartRow =
        existing ??
        (await tx.cart.create({
          data: {
            userId,
            restaurantId,
            selectedBranchId: branchId,
            currency: menuItem.currency,
          },
        }));

      const existingItem = await tx.cartItem.findUnique({
        where: {
          cartId_menuItemId: { cartId: cartRow.id, menuItemId: dto.menuItemId },
        },
      });

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + dto.quantity,
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cartRow.id,
            menuItemId: dto.menuItemId,
            quantity: dto.quantity,
            notes: dto.notes,
          },
        });
      }

      await tx.cart.update({
        where: { id: cartRow.id },
        data: { updatedAt: new Date() },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: cartRow.id },
        include: this.cartInclude(),
      });
    });

    return this.toCartResponse(cart);
  }

  async updateItem(
    userId: string,
    restaurantId: string,
    menuItemId: string,
    dto: UpdateCartItemDto,
  ) {
    if (dto.quantity === undefined && dto.notes === undefined) {
      throw new BadRequestException('Provide quantity and/or notes to update');
    }

    const cart = await this.requireCart(userId, restaurantId);
    const item = cart.items.find((i) => i.menuItemId === menuItemId);
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    return this.getCart(userId, restaurantId);
  }

  async removeItem(userId: string, restaurantId: string, menuItemId: string) {
    const cart = await this.requireCart(userId, restaurantId);
    const item = cart.items.find((i) => i.menuItemId === menuItemId);
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (cart.items.length === 1) {
      await prisma.cart.delete({ where: { id: cart.id } });
      return { deleted: true as const, restaurantId };
    }

    await prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId, restaurantId);
  }

  async clearCart(userId: string, restaurantId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    await prisma.cart.delete({ where: { id: cart.id } });
    return { deleted: true as const, restaurantId };
  }

  /**
   * Change fulfillment branch; keep lines; flag availability at the new branch.
   * Also updates UserRestaurantPreference (sticky favored branch).
   */
  async setBranch(userId: string, restaurantId: string, branchId: string) {
    await this.preferredBranchService.setPreferredBranch(userId, restaurantId, branchId);
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: this.cartInclude(),
    });
    if (!cart || cart.items.length === 0) {
      // Preference updated even without a cart.
      return {
        restaurantId,
        selectedBranchId: branchId,
        cart: null,
      };
    }
    return this.toCartResponse(cart);
  }

  private async ensureCartBranch(userId: string, restaurantId: string): Promise<string> {
    const existing = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      select: { selectedBranchId: true },
    });
    if (existing) return existing.selectedBranchId;
    return this.preferredBranchService.requirePreferredBranchId(userId, restaurantId);
  }

  private async requireCart(userId: string, restaurantId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: this.cartInclude(),
    });
    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }
    return cart;
  }

  private async requireMenuItemForRestaurant(restaurantId: string, menuItemId: string) {
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: menuItemId,
        menuCategory: { menu: { restaurantId } },
      },
      select: {
        id: true,
        name: true,
        priceCents: true,
        currency: true,
        isAvailable: true,
        menuCategory: { select: { menu: { select: { isActive: true } } } },
      },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found for this restaurant');
    }
    return menuItem;
  }

  private async assertOfferedAtBranch(branchId: string, menuItemId: string) {
    const offer = await prisma.branchMenuItemAvailability.findUnique({
      where: { branchId_menuItemId: { branchId, menuItemId } },
    });
    if (!isOfferedAtBranch(offer)) {
      throw new BadRequestException(
        'Item is not offered or is out of stock at the selected branch',
      );
    }
  }

  private cartInclude() {
    return {
      restaurant: { select: { id: true, name: true, slug: true } },
      selectedBranch: {
        select: { id: true, name: true, restaurantId: true },
      },
      items: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              currency: true,
              isAvailable: true,
              imageMedia: { select: { publicUrl: true } },
              branchAvailabilities: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private toCartResponse(
    cart: Awaited<ReturnType<CartService['requireCart']>>,
  ) {
    const branchId = cart.selectedBranchId;
    const items = cart.items.map((item) => {
      const offer = item.menuItem.branchAvailabilities.find((a) => a.branchId === branchId);
      const availableAtSelectedBranch = isOfferedAtBranch(offer);
      return {
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem.name,
        quantity: item.quantity,
        notes: item.notes,
        unitPriceCents: item.menuItem.priceCents,
        currency: item.menuItem.currency,
        imageUrl: item.menuItem.imageMedia?.publicUrl ?? null,
        availableAtSelectedBranch,
        lineTotalCents: item.menuItem.priceCents * item.quantity,
      };
    });

    return {
      id: cart.id,
      restaurantId: cart.restaurantId,
      restaurant: cart.restaurant,
      selectedBranchId: cart.selectedBranchId,
      selectedBranch: cart.selectedBranch,
      currency: cart.currency,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
      hasUnavailableItems: items.some((i) => !i.availableAtSelectedBranch),
      items,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
