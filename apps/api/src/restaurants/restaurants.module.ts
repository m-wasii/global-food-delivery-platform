import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantOwnershipService } from './restaurant-ownership.service';

@Module({
  imports: [AuthModule],
  providers: [RestaurantOwnershipService],
  exports: [RestaurantOwnershipService],
})
export class RestaurantsModule {}
