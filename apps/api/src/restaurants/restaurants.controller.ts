import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { RequireAdminGuard } from '../auth/require-capability.guard';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateOperatingCityDto } from './dto/create-operating-city.dto';

@ApiTags('restaurants')
@Controller()
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get('operating-cities')
  @ApiOperation({ summary: 'List platform operating cities (Foodpanda-style coverage)' })
  @ApiQuery({ name: 'all', required: false, description: 'Include inactive when true (admin UX)' })
  listOperatingCities(@Query('all') all?: string) {
    return this.restaurantsService.listOperatingCities(all !== 'true');
  }

  @Post('operating-cities')
  @UseGuards(SessionAuthGuard, RequireAdminGuard)
  @ApiOperation({ summary: 'Create a platform operating city (admin)' })
  createOperatingCity(@Body() dto: CreateOperatingCityDto) {
    return this.restaurantsService.createOperatingCity(dto);
  }

  @Post('restaurants')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Onboard a restaurant; caller becomes ACTIVE OWNER' })
  createRestaurant(@Req() req: AuthenticatedRequest, @Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.createRestaurant(req.user.id, dto);
  }

  @Get('restaurants/mine')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List restaurants the current user belongs to' })
  listMyRestaurants(@Req() req: AuthenticatedRequest) {
    return this.restaurantsService.listMyRestaurants(req.user.id);
  }

  @Get('restaurants/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get a restaurant and branches (member only)' })
  getRestaurant(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.restaurantsService.getRestaurantForMember(req.user.id, id);
  }

  @Patch('restaurants/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update restaurant name/slug (owner)' })
  updateRestaurant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.updateRestaurant(req.user.id, id, dto);
  }

  @Post('restaurants/:id/activate')
  @UseGuards(SessionAuthGuard, RequireAdminGuard)
  @ApiOperation({ summary: 'Approve/activate a restaurant (admin)' })
  activateRestaurant(@Param('id') id: string) {
    return this.restaurantsService.activateRestaurant(id);
  }

  @Post('restaurants/:id/suspend')
  @UseGuards(SessionAuthGuard, RequireAdminGuard)
  @ApiOperation({ summary: 'Suspend a restaurant (admin)' })
  suspendRestaurant(@Param('id') id: string) {
    return this.restaurantsService.suspendRestaurant(id);
  }

  @Post('restaurants/:id/branches')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Add a branch (owner); starts INACTIVE' })
  createBranch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.restaurantsService.createBranch(req.user.id, id, dto);
  }

  @Get('restaurants/:id/branches')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List branches for a restaurant (member)' })
  listBranches(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.restaurantsService.listBranches(req.user.id, id);
  }

  @Patch('restaurants/:id/branches/:branchId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update branch details and service area (owner)' })
  updateBranch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.restaurantsService.updateBranch(req.user.id, id, branchId, dto);
  }

  @Post('restaurants/:id/branches/:branchId/activate')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Activate a branch for ordering (owner)' })
  activateBranch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
  ) {
    return this.restaurantsService.activateBranch(req.user.id, id, branchId);
  }

  @Post('restaurants/:id/branches/:branchId/deactivate')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Deactivate a branch (owner); excluded from ordering' })
  deactivateBranch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
  ) {
    return this.restaurantsService.deactivateBranch(req.user.id, id, branchId);
  }
}
