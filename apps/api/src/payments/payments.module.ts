import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider';
import { NoopPaymentProvider } from './noop-payment.provider';

@Module({
  providers: [
    NoopPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: NoopPaymentProvider,
    },
  ],
  exports: [PAYMENT_PROVIDER, NoopPaymentProvider],
})
export class PaymentsModule {}
