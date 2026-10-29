import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { OrdersService } from './orders.service';
import { TransitionOrderDto } from './dto/transition-order.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(SessionAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get order with status history and allowed transitions (customer, partner, or admin)',
  })
  get(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.ordersService.getOrder(req.user.id, orderId);
  }

  @Post(':orderId/transition')
  @ApiOperation({
    summary:
      'Apply an allowed status transition and append history (invalid transitions rejected)',
  })
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: TransitionOrderDto,
  ) {
    return this.ordersService.transition(
      req.user.id,
      orderId,
      dto.toStatus,
      dto.reason,
    );
  }
}
