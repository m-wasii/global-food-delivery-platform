import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantsController, MenusController],
  providers: [RestaurantOwnershipService, RestaurantsService, MenusService],
  exports: [RestaurantOwnershipService, RestaurantsService, MenusService],
})
export class RestaurantsModule {}
