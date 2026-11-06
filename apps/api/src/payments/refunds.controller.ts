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
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

/**
 * Ops/staff HTTP surface over RefundsService (EAT-79).
 * Rules stay in planRefund; issuing stays in RefundsService.issue.
 */
@ApiTags('refunds')
@Controller('payments/:paymentId/refunds')
@UseGuards(SessionAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated key (≤255 chars). Retries with the same key replay the first refund result.',
  })
  @ApiOperation({
    summary:
      'Issue a full or partial refund for a captured payment (idempotent)',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.refundsService.issue({
      paymentId,
      amountCents: dto.amountCents,
      reason: dto.reason,
      idempotencyKey,
      actorUserId: req.user.id,
    });
  }
}
