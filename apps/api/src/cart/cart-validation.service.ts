import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import {
  evaluateBranchAvailability,
  isBranchStructurallyOrderable,
} from '../restaurants/availability';
import { evaluateCartValidation } from './cart-validation';

@Injectable()
export class CartValidationService {
  /**
   * Soft report for UI — never mutates the cart.
   */
  async validateCart(userId: string, restaurantId: string) {
    const result = await this.evaluate(userId, restaurantId);
    return {
      valid: result.valid,
      restaurantId,
      selectedBranchId: result.selectedBranchId,
      currency: result.currency,
      subtotalCents: result.subtotalCents,
      minimumOrderCents: result.minimumOrderCents,
      issues: result.issues,
    };
  }

  /**
   * Hard gate for checkout (EAT-34). Throws when the cart is not orderable.
   */
  async assertValidForCheckout(userId: string, restaurantId: string) {
    const result = await this.evaluate(userId, restaurantId);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Cart is not valid for checkout',
        code: 'CART_INVALID',
        issues: result.issues,
      });
    }
    return {
      restaurantId,
      selectedBranchId: result.selectedBranchId,
      currency: result.currency,
      subtotalCents: result.subtotalCents,
      minimumOrderCents: result.minimumOrderCents,
    };
  }

  private async evaluate(userId: string, restaurantId: string) {
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                menuCategory: { include: { menu: true } },
                branchAvailabilities: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    const branch = await prisma.restaurantBranch.findUnique({
      where: { id: cart.selectedBranchId },
      include: {
        restaurant: true,
        operatingCity: true,
        weeklyHours: true,
        exceptions: true,
      },
    });
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new BadRequestException('Cart selected branch is invalid for this restaurant');
    }

    const structurallyOrderable = isBranchStructurallyOrderable({
      restaurantStatus: branch.restaurant.status,
      branchStatus: branch.status,
      operatingCityIsActive: branch.operatingCity.isActive,
      temporarilyClosed: branch.temporarilyClosed,
      latitude: branch.latitude != null ? Number(branch.latitude) : null,
      longitude: branch.longitude != null ? Number(branch.longitude) : null,
      deliveryRadiusKm:
        branch.deliveryRadiusKm != null ? Number(branch.deliveryRadiusKm) : null,
    });

    const hours = evaluateBranchAvailability({
      temporarilyClosed: branch.temporarilyClosed,
      timezone: branch.timezone,
      weeklyHours: branch.weeklyHours,
      exceptions: branch.exceptions,
    });

    const evaluation = evaluateCartValidation({
      cartCurrency: cart.currency,
      branch: {
        structurallyOrderable,
        isOpen: hours.isOpen,
        closedReason: hours.reason,
        minimumOrderCents: branch.minimumOrderCents,
      },
      lines: cart.items.map((item) => {
        const offer =
          item.menuItem.branchAvailabilities.find((a) => a.branchId === cart.selectedBranchId) ??
          null;
        return {
          cartItemId: item.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          currency: item.menuItem.currency,
          unitPriceCents: item.menuItem.priceCents,
          menuItemIsAvailable: item.menuItem.isAvailable,
          menuIsActive: item.menuItem.menuCategory.menu.isActive,
          branchOffer: offer ? { isAvailable: offer.isAvailable } : null,
        };
      }),
    });

    return {
      valid: evaluation.valid,
      selectedBranchId: cart.selectedBranchId,
      currency: cart.currency,
      subtotalCents: evaluation.subtotalCents,
      minimumOrderCents: branch.minimumOrderCents,
      issues: evaluation.issues,
    };
  }
}
