import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider';
import { NoopPaymentProvider } from './noop-payment.provider';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@Module({
  providers: [
    NoopPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: NoopPaymentProvider,
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
