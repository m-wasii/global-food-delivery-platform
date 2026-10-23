import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressesService {
  private activeWhere(userId: string, addressId?: string) {
    return {
      ...(addressId ? { id: addressId } : {}),
      userId,
      deletedAt: null,
    };
  }

  async getAddresses(userId: string) {
    const [addresses, user] = await Promise.all([
      prisma.address.findMany({ where: this.activeWhere(userId) }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { defaultAddressId: true },
      }),
    ]);

    return {
      addresses,
      defaultAddressId: user?.defaultAddressId ?? null,
    };
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const result = await prisma.address.findFirst({
      where: this.activeWhere(userId, addressId),
    });
    if (!result) {
      throw new NotFoundException('Address not found');
    }
    const address = await prisma.address.update({
      where: { id: addressId },
      data: { ...dto },
    });

    return {
      message: 'Address updated successfully',
      address,
    };
  }

  async deleteAddress(userId: string, addressId: string) {
    const result = await prisma.address.findFirst({
      where: this.activeWhere(userId, addressId),
    });
    if (!result) {
      throw new NotFoundException('Address not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: new Date() },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { defaultAddressId: true },
      });

      if (user?.defaultAddressId === addressId) {
        await tx.user.update({
          where: { id: userId },
          data: { defaultAddressId: null },
        });
      }
    });

    return { id: addressId };
  }

  async restoreAddress(userId: string, addressId: string) {
    const result = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        deletedAt: { not: null },
      },
    });
    if (!result) {
      throw new NotFoundException('Address not found');
    }

    const address = await prisma.$transaction(async (tx) => {
      const restored = await tx.address.update({
        where: { id: addressId },
        data: { deletedAt: null },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { defaultAddressId: true },
      });

      // If nothing is active yet, make the restored address the delivery destination.
      if (!user?.defaultAddressId) {
        await tx.user.update({
          where: { id: userId },
          data: { defaultAddressId: addressId },
        });
      }

      return restored;
    });

    return { address };
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const address = await prisma.address.create({
      data: { ...dto, userId },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultAddressId: true },
    });

    if (!user?.defaultAddressId) {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultAddressId: address.id },
      });
    }

    return address;
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const result = await prisma.address.findFirst({
      where: this.activeWhere(userId, addressId),
    });
    if (!result) {
      throw new NotFoundException('Address not found');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { defaultAddressId: addressId },
    });
    return { defaultAddressId: addressId };
  }

  async getDefaultAddress(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        defaultAddress: true,
      },
    });
    if (!user?.defaultAddress || user.defaultAddress.deletedAt) {
      return null;
    }
    return user.defaultAddress;
  }
}
