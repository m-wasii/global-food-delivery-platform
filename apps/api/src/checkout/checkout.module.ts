import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { IDEMPOTENCY_STORE } from '../common/idempotency.tokens';
import { PrismaIdempotencyStore } from '../common/prisma-idempotency.store';
import { OrdersModule } from '../orders/orders.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [AuthModule, CartModule, OrdersModule],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    PrismaIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useExisting: PrismaIdempotencyStore,
    },
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
