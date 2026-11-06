import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated key (≤255 chars). Retries with the same key replay the first confirm result.',
  })
  @ApiOperation({
    summary:
      'Confirm checkout: create PENDING order with line snapshots, clear cart (idempotent)',
  })
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.checkoutService.confirm(
      req.user.id,
      restaurantId,
      dto,
      idempotencyKey,
    );
  }
}
