import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { BranchMenuAvailabilityService } from './branch-menu-availability.service';
import { SetBranchMenuItemAvailabilityDto } from './dto/set-branch-menu-item-availability.dto';

@ApiTags('branch-menu-availability')
@Controller('restaurants/:restaurantId/branches/:branchId/menu-items')
@UseGuards(SessionAuthGuard)
export class BranchMenuAvailabilityController {
  constructor(private readonly availability: BranchMenuAvailabilityService) {}

  @Get('availability')
  @ApiOperation({
    summary: 'List opt-in menu item offerings for a branch (member)',
  })
  list(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.availability.listForBranch(req.user.id, restaurantId, branchId);
  }

  @Put(':menuItemId/availability')
  @ApiOperation({
    summary: 'Opt a menu item into a branch (or mark in/out of stock)',
  })
  upsert(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: SetBranchMenuItemAvailabilityDto,
  ) {
    return this.availability.upsert(
      req.user.id,
      restaurantId,
      branchId,
      menuItemId,
      dto,
    );
  }

  @Delete(':menuItemId/availability')
  @ApiOperation({
    summary: 'Stop offering a menu item at this branch (remove opt-in row)',
  })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.availability.remove(req.user.id, restaurantId, branchId, menuItemId);
  }
}
