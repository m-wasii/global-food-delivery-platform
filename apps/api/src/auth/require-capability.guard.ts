import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import type { AuthenticatedRequest } from './session-auth.guard';

function requireUser(context: ExecutionContext): AuthenticatedRequest {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
        throw new UnauthorizedException('Authentication required');
    }
    return req;
}

@Injectable()
export class RequireCourierGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = requireUser(context);
        const profile = await prisma.courierProfile.findUnique({
            where: { userId: req.user.id },
            select: { status: true },
        });
        if (!profile || profile.status !== 'ACTIVE') {
            throw new ForbiddenException('Courier capability required');
        }
        return true;
    }
}

@Injectable()
export class RequireAdminGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = requireUser(context);
        const grant = await prisma.adminGrant.findUnique({
            where: { userId: req.user.id },
            select: { id: true },
        });
        if (!grant) {
            throw new ForbiddenException('Admin capability required');
        }
        return true;
    }
}

@Injectable()
export class RequirePartnerGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = requireUser(context);
        const membership = await prisma.restaurantMembership.findFirst({
            where: { userId: req.user.id, status: 'ACTIVE' },
            select: { id: true },
        });
        if (!membership) {
            throw new ForbiddenException('Partner capability required');
        }
        return true;
    }
}