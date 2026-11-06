import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IDEMPOTENCY_STORE } from '../common/idempotency.tokens';
import { PrismaIdempotencyStore } from '../common/prisma-idempotency.store';
import { PAYMENT_PROVIDER } from './payment-provider';
import { NoopPaymentProvider } from './noop-payment.provider';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentsService } from './payments.service';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [AuthModule],
  controllers: [RefundsController, PaymentWebhooksController],
  providers: [
    NoopPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: NoopPaymentProvider,
    },
    PrismaIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useExisting: PrismaIdempotencyStore,
    },
    PaymentsService,
    RefundsService,
  ],
  exports: [
    PAYMENT_PROVIDER,
    NoopPaymentProvider,
    PaymentsService,
    RefundsService,
  ],
})
export class PaymentsModule {}
