import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourierAvailabilityController } from './courier-availability.controller';
import { CourierAvailabilityService } from './courier-availability.service';

/**
 * Courier domain (EAT-51 / EAT-52). Profile + availability rules live in
 * `courier-profile.ts`; HTTP onboarding CRUD remains deferred.
 */
@Module({
  imports: [AuthModule],
  controllers: [CourierAvailabilityController],
  providers: [CourierAvailabilityService],
  exports: [CourierAvailabilityService],
})
export class CouriersModule {}
