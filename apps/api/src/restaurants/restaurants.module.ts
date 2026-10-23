import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantsController, MenusController, DiscoveryController],
  providers: [
    RestaurantOwnershipService,
    RestaurantsService,
    MenusService,
    DiscoveryService,
  ],
  exports: [
    RestaurantOwnershipService,
    RestaurantsService,
    MenusService,
    DiscoveryService,
  ],
})
export class RestaurantsModule {}
