import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { OrdersService } from './orders.service';
import { TransitionOrderDto } from './dto/transition-order.dto';

class ListMyOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

@ApiTags('orders')
@Controller('orders')
@UseGuards(SessionAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List the current user’s orders (newest first; paginated)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(@Req() req: AuthenticatedRequest, @Query() query: ListMyOrdersQueryDto) {
    return this.ordersService.listMyOrders(req.user.id, query);
  }

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
    return this.ordersService.transition(req.user.id, orderId, dto.toStatus, {
      cancelReason: dto.cancelReason,
      reason: dto.reason,
    });
  }
}
