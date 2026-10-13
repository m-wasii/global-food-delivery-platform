import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { AuthService } from './auth.service';
import { EmailVerificationTokenService } from './email-verification-token.service';

@Module({
    controllers: [AuthController],
    providers: [PasswordService,AuthService,EmailVerificationTokenService],
    exports: [PasswordService],
})
export class AuthModule {}