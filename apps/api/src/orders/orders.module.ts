import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { OrdersController } from './orders.controller';
import { PartnerOrdersController } from './partner-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, RestaurantsModule],
  controllers: [OrdersController, PartnerOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
