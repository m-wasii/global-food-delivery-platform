import { prisma, Prisma } from '@food-delivery/database';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';
import { TokenHashService } from './token-hash.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private readonly passwordService: PasswordService,
    private readonly tokenHashService: TokenHashService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const rememberMe = dto.rememberMe ?? false;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before logging in');
    }

    const { rawToken, tokenHash } = this.tokenHashService.createToken();
    const ttlMs = rememberMe
      ? 1000 * 60 * 60 * 24 * 30
      : 1000 * 60 * 60 * 24;
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        rememberMe,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      rawToken,
      rememberMe,
    };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken){
      return;
    }

    const tokenHash = this.tokenHashService.hashToken(rawToken);

    await prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    
    try {
        const user = await prisma.user.create({
            data: { email, name, passwordHash },
            select: { id: true, email: true, name: true, createdAt: true },
        });

        const { rawToken, tokenHash } = this.tokenHashService.createToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

        await prisma.emailVerificationToken.create({
            data: {
              userId: user.id,
                tokenHash,
                expiresAt,
            },
        });

        const verifyUrl = `${process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000'}/verify-email?token=${rawToken}`;
        console.log(`[auth] verify email link for ${user.email}: ${verifyUrl}`);

        return user;
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new ConflictException('Email already in use');
        }
        throw error;
    }
  }
  async verifyEmail(rawToken: string) {
    const tokenHash = this.tokenHashService.hashToken(rawToken);
  
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
  
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
  
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  
    return { verified: true };
  }

  async resendVerification(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
  
    const user = await prisma.user.findUnique({ where: { email } });
  
    // Same generic response whether missing / already verified — avoids email probing
    if (!user || user.emailVerifiedAt) {
      return { sent: true };
    }
  
    const { rawToken, tokenHash } =
      this.tokenHashService.createToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  
    await prisma.$transaction([
      prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);
  
    const verifyUrl = `${process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000'}/verify-email?token=${rawToken}`;
    console.log(`[auth] verify email link for ${user.email}: ${verifyUrl}`);
  
    return { sent: true };
  }

}