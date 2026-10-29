import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MediaModule } from './media/media.module';
import { CartModule } from './cart/cart.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    RestaurantsModule,
    MediaModule,
    CartModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, RequestLoggingMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}