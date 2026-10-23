import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { prisma } from '@food-delivery/database';
import { TokenHashService } from './token-hash.service';
import type { AuthUser } from './session-auth.guard';

export type OptionallyAuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Attaches req.user when a valid session cookie is present.
 * Never rejects — public endpoints that optionally use the caller.
 */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly tokenHashService: TokenHashService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OptionallyAuthenticatedRequest>();
    const rawToken = req.cookies?.session as string | undefined;
    if (!rawToken) {
      return true;
    }

    const tokenHash = this.tokenHashService.hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return true;
    }

    req.user = session.user;
    return true;
  }
}
