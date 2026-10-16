import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SessionAuthGuard, type AuthenticatedRequest } from './session-auth.guard';
import { RequireAdminGuard, RequireCourierGuard, RequirePartnerGuard } from './require-capability.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a customer account' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and create a session cookie' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, rawToken, rememberMe } = await this.authService.login(body);

    res.cookie('session', rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(rememberMe
        ? { maxAge: 30 * 24 * 60 * 60 * 1000 } //align with session TTL
        : {}), // no maxAge → browser session cookie
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate the current session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.session);

    res.clearCookie('session', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Current authenticated user and derived capabilities' })
  async me(@Req() req: AuthenticatedRequest) {
    const capabilities = await this.authService.getCapabilities(req.user.id);
    return { user: {...req.user, capabilities} };
  }

  @Get('courier-only')
  @UseGuards(SessionAuthGuard, RequireCourierGuard)
  @ApiOperation({ summary: 'Requires an ACTIVE courier profile' })
  courierOnly() {
    return { ok: true };
  }

  @Get('admin-only')
  @UseGuards(SessionAuthGuard, RequireAdminGuard)
  @ApiOperation({ summary: 'Requires an admin grant' })
  adminOnly() {
    return { ok: true };
  }

  @Get('partner-only')
  @UseGuards(SessionAuthGuard, RequirePartnerGuard)
  @ApiOperation({ summary: 'Requires an ACTIVE restaurant membership' })
  partnerOnly() {
    return { ok: true };
  }
  
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify customer email with token from link' })
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  resendVerification(@Body() body: ResendVerificationDto) {
    return this.authService.resendVerification(body.email);
  }
}