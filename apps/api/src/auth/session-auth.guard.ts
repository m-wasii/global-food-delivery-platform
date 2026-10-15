import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { prisma } from '@food-delivery/database';
import { TokenHashService } from './token-hash.service';

export type AuthUser = {
    id: string;
    email: string;
    name: string;
};

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class SessionAuthGuard implements CanActivate {
    constructor(private readonly tokenHashService: TokenHashService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const rawToken = req.cookies?.session as string | undefined;

        if (!rawToken) {
            throw new UnauthorizedException('Authentication required');
        }

        const tokenHash = this.tokenHashService.hashToken(rawToken);

        const session = await prisma.session.findUnique({
            where: { tokenHash },
            include: {
                user: {
                    select: { id: true, email: true, name: true },
                },
            },
        });

        if (
            !session ||
            session.revokedAt ||
            session.expiresAt < new Date()
        ) {
            throw new UnauthorizedException('Authentication required');
        }

        req.user = session.user;
        return true;
    }
}