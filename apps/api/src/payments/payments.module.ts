import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider';
import { NoopPaymentProvider } from './noop-payment.provider';
import { PaymentsService } from './payments.service';

@Module({
  providers: [
    NoopPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: NoopPaymentProvider,
    },
    PaymentsService,
  ],
  exports: [PAYMENT_PROVIDER, NoopPaymentProvider, PaymentsService],
})
export class PaymentsModule {}
