import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { RequirePartnerGuard } from '../auth/require-capability.guard';
import { ListPartnerOrdersQueryDto } from './dto/list-partner-orders.dto';
import { OrdersService } from './orders.service';

/**
 * Partner ops surface for the incoming order queue (EAT-40).
 * Transitions remain on `POST /orders/:id/transition`.
 */
@ApiTags('partner-orders')
@Controller('partner/orders')
@UseGuards(SessionAuthGuard, RequirePartnerGuard)
export class PartnerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary:
      'List orders for a restaurant the caller belongs to (paginated; poll every 3–5s)',
  })
  list(@Req() req: AuthenticatedRequest, @Query() query: ListPartnerOrdersQueryDto) {
    return this.ordersService.listPartnerOrders(req.user.id, query);
  }
}
