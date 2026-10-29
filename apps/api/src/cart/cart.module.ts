import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PreferredBranchService } from './preferred-branch.service';
import { PreferredBranchController } from './preferred-branch.controller';

@Module({
  imports: [AuthModule, RestaurantsModule],
  controllers: [CartController, PreferredBranchController],
  providers: [CartService, PreferredBranchService],
  exports: [CartService, PreferredBranchService],
})
export class CartModule {}
