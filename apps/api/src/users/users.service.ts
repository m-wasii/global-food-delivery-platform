import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        return { user };
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { name: dto.name },
            select: { id: true, name: true, email: true },
        });
        return {
            message: 'Profile updated successfully',
            user,
        };
    }
}