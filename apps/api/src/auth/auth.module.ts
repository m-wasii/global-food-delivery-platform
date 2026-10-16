import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { AuthService } from './auth.service';
import { TokenHashService } from './token-hash.service';
import { SessionAuthGuard } from './session-auth.guard';
import { RequireCourierGuard, RequireAdminGuard, RequirePartnerGuard } from './require-capability.guard';

@Module({
    controllers: [AuthController],
    providers: [PasswordService, AuthService, TokenHashService, SessionAuthGuard, RequireCourierGuard, RequireAdminGuard, RequirePartnerGuard],
    exports: [PasswordService, SessionAuthGuard, RequireCourierGuard, RequireAdminGuard, RequirePartnerGuard],
})
export class AuthModule {}