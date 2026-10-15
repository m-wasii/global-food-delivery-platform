import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { AuthService } from './auth.service';
import { TokenHashService } from './token-hash.service';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
    controllers: [AuthController],
    providers: [PasswordService, AuthService, TokenHashService, SessionAuthGuard],
    exports: [PasswordService, SessionAuthGuard],
})
export class AuthModule {}