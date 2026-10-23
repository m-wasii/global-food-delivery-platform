import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@ApiTags('menus')
@Controller('restaurants/:restaurantId/menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Create a menu for the restaurant (member)' })
  createMenu(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateMenuDto,
  ) {
    return this.menusService.createMenu(req.user.id, restaurantId, dto);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List menus for the restaurant (member)' })
  listMenus(@Req() req: AuthenticatedRequest, @Param('restaurantId') restaurantId: string) {
    return this.menusService.listMenus(req.user.id, restaurantId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Public: active menu with available items' })
  getActiveMenu(@Param('restaurantId') restaurantId: string) {
    return this.menusService.getActiveMenuForRestaurant(restaurantId);
  }

  @Get(':menuId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get full menu tree including unavailable items (member)' })
  getMenu(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.getMenu(req.user.id, restaurantId, menuId);
  }

  @Patch(':menuId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update menu name or active flag (member)' })
  updateMenu(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menusService.updateMenu(req.user.id, restaurantId, menuId, dto);
  }

  @Delete(':menuId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete a menu and its categories/items (member)' })
  deleteMenu(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.deleteMenu(req.user.id, restaurantId, menuId);
  }

  @Post(':menuId/categories')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Add a category to a menu (member)' })
  createCategory(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menusService.createCategory(req.user.id, restaurantId, menuId, dto);
  }

  @Patch(':menuId/categories/:categoryId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update a menu category (member)' })
  updateCategory(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menusService.updateCategory(
      req.user.id,
      restaurantId,
      menuId,
      categoryId,
      dto,
    );
  }

  @Delete(':menuId/categories/:categoryId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete a menu category and its items (member)' })
  deleteCategory(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menusService.deleteCategory(req.user.id, restaurantId, menuId, categoryId);
  }

  @Post(':menuId/categories/:categoryId/items')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Add a menu item (member)' })
  createItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menusService.createItem(
      req.user.id,
      restaurantId,
      menuId,
      categoryId,
      dto,
    );
  }

  @Patch(':menuId/categories/:categoryId/items/:itemId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update a menu item (member)' })
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menusService.updateItem(
      req.user.id,
      restaurantId,
      menuId,
      categoryId,
      itemId,
      dto,
    );
  }

  @Delete(':menuId/categories/:categoryId/items/:itemId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete a menu item (member)' })
  deleteItem(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menusService.deleteItem(
      req.user.id,
      restaurantId,
      menuId,
      categoryId,
      itemId,
    );
  }
}
