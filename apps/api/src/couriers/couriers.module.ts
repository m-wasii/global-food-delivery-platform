import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

/**
 * Courier domain shell (EAT-51). Profile rules live in `courier-profile.ts`;
 * HTTP onboarding / availability land in later milestone issues.
 */
@Module({
  imports: [AuthModule],
})
export class CouriersModule {}
