import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { RestaurantOwnershipService } from './restaurant-ownership.service';
import { MediaService } from '../media/media.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const menuTreeInclude = {
  categories: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: { imageMedia: true },
      },
    },
  },
};

@Injectable()
export class MenusService {
  constructor(
    private readonly ownership: RestaurantOwnershipService,
    private readonly mediaService: MediaService,
  ) {}

  async createMenu(userId: string, restaurantId: string, dto: CreateMenuDto) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    return prisma.menu.create({
      data: {
        restaurantId,
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listMenus(userId: string, restaurantId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    return prisma.menu.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { categories: true } },
      },
    });
  }

  async getMenu(userId: string, restaurantId: string, menuId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    const menu = await prisma.menu.findFirst({
      where: { id: menuId, restaurantId },
      include: menuTreeInclude,
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    return menu;
  }

  /** Customer-facing tree: active menu with available items only. */
  async getActiveMenuForRestaurant(restaurantId: string) {
    const menu = await prisma.menu.findFirst({
      where: { restaurantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: { imageMedia: true },
            },
          },
        },
      },
    });
    if (!menu) {
      throw new NotFoundException('No active menu for this restaurant');
    }
    return menu;
  }

  async updateMenu(userId: string, restaurantId: string, menuId: string, dto: UpdateMenuDto) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireMenu(restaurantId, menuId);

    return prisma.menu.update({
      where: { id: menuId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteMenu(userId: string, restaurantId: string, menuId: string) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireMenu(restaurantId, menuId);
    await prisma.menu.delete({ where: { id: menuId } });
    return { id: menuId };
  }

  async createCategory(
    userId: string,
    restaurantId: string,
    menuId: string,
    dto: CreateMenuCategoryDto,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireMenu(restaurantId, menuId);

    return prisma.menuCategory.create({
      data: {
        menuId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(
    userId: string,
    restaurantId: string,
    menuId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireCategory(restaurantId, menuId, categoryId);

    return prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deleteCategory(
    userId: string,
    restaurantId: string,
    menuId: string,
    categoryId: string,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireCategory(restaurantId, menuId, categoryId);
    await prisma.menuCategory.delete({ where: { id: categoryId } });
    return { id: categoryId };
  }

  async createItem(
    userId: string,
    restaurantId: string,
    menuId: string,
    categoryId: string,
    dto: CreateMenuItemDto,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireCategory(restaurantId, menuId, categoryId);
    if (dto.imageMediaId) {
      await this.mediaService.requireExisting(dto.imageMediaId);
    }

    return prisma.menuItem.create({
      data: {
        menuCategoryId: categoryId,
        name: dto.name,
        description: dto.description,
        imageMediaId: dto.imageMediaId,
        priceCents: dto.priceCents,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { imageMedia: true },
    });
  }

  async updateItem(
    userId: string,
    restaurantId: string,
    menuId: string,
    categoryId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireItem(restaurantId, menuId, categoryId, itemId);
    if (dto.imageMediaId) {
      await this.mediaService.requireExisting(dto.imageMediaId);
    }

    return prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageMediaId !== undefined ? { imageMediaId: dto.imageMediaId } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { imageMedia: true },
    });
  }

  async deleteItem(
    userId: string,
    restaurantId: string,
    menuId: string,
    categoryId: string,
    itemId: string,
  ) {
    await this.ownership.assertActiveMember(userId, restaurantId);
    await this.requireItem(restaurantId, menuId, categoryId, itemId);
    await prisma.menuItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  private async requireMenu(restaurantId: string, menuId: string) {
    const menu = await prisma.menu.findFirst({
      where: { id: menuId, restaurantId },
      select: { id: true },
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    return menu;
  }

  private async requireCategory(restaurantId: string, menuId: string, categoryId: string) {
    await this.requireMenu(restaurantId, menuId);
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, menuId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Menu category not found');
    }
    return category;
  }

  private async requireItem(
    restaurantId: string,
    menuId: string,
    categoryId: string,
    itemId: string,
  ) {
    await this.requireCategory(restaurantId, menuId, categoryId);
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, menuCategoryId: categoryId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }
}
