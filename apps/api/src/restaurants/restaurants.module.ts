import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantsController],
  providers: [RestaurantOwnershipService, RestaurantsService],
  exports: [RestaurantOwnershipService, RestaurantsService],
})
export class RestaurantsModule {}
