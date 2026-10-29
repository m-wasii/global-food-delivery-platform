import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { priceCart, type PriceBreakdown } from './pricing';
import { loadPricingDefaults } from './pricing-config';
import { CartValidationService } from './cart-validation.service';

export interface CartQuote {
  restaurantId: string;
  selectedBranchId: string;
  pricing: PriceBreakdown;
  validation: {
    valid: boolean;
    issues: Awaited<ReturnType<CartValidationService['validateCart']>>['issues'];
  };
}

@Injectable()
export class PricingService {
  constructor(private readonly cartValidation: CartValidationService) {}

  /**
   * Server-side quote for a cart. Reproducible for the same lines + fee inputs.
   * Soft validation is attached for UI; checkout will hard-assert separately.
   */
  async quoteCart(
    userId: string,
    restaurantId: string,
    overrides?: { discount?: number },
  ): Promise<CartQuote> {
    const cart = await prisma.cart.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      include: {
        items: {
          include: {
            menuItem: { select: { id: true, priceCents: true, currency: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart not found');
    }

    const defaults = loadPricingDefaults();
    const pricing = priceCart({
      currency: cart.currency,
      lines: cart.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.menuItem.priceCents,
      })),
      discount: overrides?.discount ?? 0,
      serviceFee: defaults.serviceFee,
      deliveryFee: defaults.deliveryFee,
      taxRateBps: defaults.taxRateBps,
    });

    const validation = await this.cartValidation.validateCart(userId, restaurantId);

    return {
      restaurantId,
      selectedBranchId: cart.selectedBranchId,
      pricing,
      validation: {
        valid: validation.valid,
        issues: validation.issues,
      },
    };
  }

  /** Pure pricing for checkout once lines are already loaded. */
  priceLines(input: {
    currency: string;
    lines: { menuItemId: string; quantity: number; unitPrice: number }[];
    discount?: number;
  }): PriceBreakdown {
    const defaults = loadPricingDefaults();
    return priceCart({
      currency: input.currency,
      lines: input.lines,
      discount: input.discount ?? 0,
      serviceFee: defaults.serviceFee,
      deliveryFee: defaults.deliveryFee,
      taxRateBps: defaults.taxRateBps,
    });
  }
}
