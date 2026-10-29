import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PreferredBranchService } from './preferred-branch.service';
import { PreferredBranchController } from './preferred-branch.controller';
import { CartValidationService } from './cart-validation.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule, RestaurantsModule],
  controllers: [CartController, PreferredBranchController],
  providers: [
    CartService,
    PreferredBranchService,
    CartValidationService,
    PricingService,
  ],
  exports: [
    CartService,
    PreferredBranchService,
    CartValidationService,
    PricingService,
  ],
})
export class CartModule {}
