import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { SearchService } from './search.service';
import { AvailabilityService } from './availability.service';
import { BranchMenuAvailabilityService } from './branch-menu-availability.service';
import { BranchMenuAvailabilityController } from './branch-menu-availability.controller';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [
    RestaurantsController,
    MenusController,
    DiscoveryController,
    BranchMenuAvailabilityController,
  ],
  providers: [
    RestaurantOwnershipService,
    RestaurantsService,
    MenusService,
    DiscoveryService,
    SearchService,
    AvailabilityService,
    BranchMenuAvailabilityService,
  ],
  exports: [
    RestaurantOwnershipService,
    RestaurantsService,
    MenusService,
    DiscoveryService,
    SearchService,
    AvailabilityService,
    BranchMenuAvailabilityService,
  ],
})
export class RestaurantsModule {}
