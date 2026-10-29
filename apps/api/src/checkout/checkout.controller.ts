import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('checkout')
@Controller('carts/:restaurantId/checkout')
@UseGuards(SessionAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('preview')
  @ApiOperation({
    summary:
      'Final pricing summary before placing an order (validates cart; soft radius when delivery address changed)',
  })
  preview(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.checkoutService.preview(req.user.id, restaurantId, dto);
  }

  @Post()
  @ApiOperation({
    summary:
      'Confirm checkout: create PENDING order with line snapshots, clear cart',
  })
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.checkoutService.confirm(req.user.id, restaurantId, dto);
  }
}
