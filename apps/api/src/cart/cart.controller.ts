import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { CartService } from './cart.service';
import { CartValidationService } from './cart-validation.service';
import { PricingService } from './pricing.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { SetCartBranchDto } from './dto/set-cart-branch.dto';

@ApiTags('carts')
@Controller('carts')
@UseGuards(SessionAuthGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly cartValidationService: CartValidationService,
    private readonly pricingService: PricingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active carts (≥1 item) for the current user' })
  list(@Req() req: AuthenticatedRequest) {
    return this.cartService.listActiveCarts(req.user.id);
  }

  @Get(':restaurantId')
  @ApiOperation({ summary: 'Get the cart for a restaurant' })
  get(@Req() req: AuthenticatedRequest, @Param('restaurantId') restaurantId: string) {
    return this.cartService.getCart(req.user.id, restaurantId);
  }

  @Post(':restaurantId/validate')
  @ApiOperation({
    summary:
      'Soft-validate cart for checkout readiness (report-only; does not mutate). Checkout uses the hard assert.',
  })
  validate(@Req() req: AuthenticatedRequest, @Param('restaurantId') restaurantId: string) {
    return this.cartValidationService.validateCart(req.user.id, restaurantId);
  }

  @Get(':restaurantId/quote')
  @ApiOperation({
    summary:
      'Server-side pricing quote (minor-unit integers). Same inputs ⇒ same breakdown (ADR 0006).',
  })
  quote(@Req() req: AuthenticatedRequest, @Param('restaurantId') restaurantId: string) {
    return this.pricingService.quoteCart(req.user.id, restaurantId);
  }

  @Post(':restaurantId/items')
  @ApiOperation({ summary: 'Add an item (creates cart if needed; merges quantity)' })
  addItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(req.user.id, restaurantId, dto);
  }

  @Patch(':restaurantId/items/:menuItemId')
  @ApiOperation({ summary: 'Update quantity or notes for a cart line' })
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.id, restaurantId, menuItemId, dto);
  }

  @Delete(':restaurantId/items/:menuItemId')
  @ApiOperation({ summary: 'Remove a line; deletes cart when empty' })
  removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.cartService.removeItem(req.user.id, restaurantId, menuItemId);
  }

  @Delete(':restaurantId')
  @ApiOperation({ summary: 'Clear and delete the restaurant cart' })
  clear(@Req() req: AuthenticatedRequest, @Param('restaurantId') restaurantId: string) {
    return this.cartService.clearCart(req.user.id, restaurantId);
  }

  @Patch(':restaurantId/branch')
  @ApiOperation({
    summary:
      'Change fulfillment branch (keeps lines; flags unavailable). Also updates preferred branch.',
  })
  setBranch(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: SetCartBranchDto,
  ) {
    return this.cartService.setBranch(req.user.id, restaurantId, dto.branchId);
  }
}
