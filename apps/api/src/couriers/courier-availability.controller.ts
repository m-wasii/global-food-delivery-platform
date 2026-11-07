import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireCourierGuard } from '../auth/require-capability.guard';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard';
import { CourierAvailabilityService } from './courier-availability.service';
import { SetCourierAvailabilityDto } from './dto/set-courier-availability.dto';

/**
 * Courier self-service online/offline (EAT-52 / ADR 0022).
 * Offer eligibility stays in `canCourierReceiveOffers`.
 */
@ApiTags('couriers')
@Controller('couriers/me/availability')
@UseGuards(SessionAuthGuard, RequireCourierGuard)
export class CourierAvailabilityController {
  constructor(private readonly availability: CourierAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Get current courier online/offline availability' })
  get(@Req() req: AuthenticatedRequest) {
    return this.availability.getForUser(req.user.id);
  }

  @Put()
  @ApiOperation({
    summary:
      'Set courier online/offline; only dispatch-eligible couriers may go online',
  })
  set(@Req() req: AuthenticatedRequest, @Body() dto: SetCourierAvailabilityDto) {
    return this.availability.setForUser(req.user.id, dto.isOnline);
  }
}
