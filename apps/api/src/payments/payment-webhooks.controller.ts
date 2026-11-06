import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';

/**
 * Provider webhook ingress (EAT-80). Signature verification lands with real
 * Stripe/Adyen adapters; Noop accepts a local envelope for smoke/dev.
 */
@ApiTags('payment-webhooks')
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Apply a payment-provider webhook (refund settlement via parseWebhook)',
  })
  apply(@Body() payload: unknown) {
    return this.refundsService.applyProviderWebhook(payload);
  }
}
