import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { PreferredBranchService } from './preferred-branch.service';
import { SetPreferredBranchDto } from './dto/set-preferred-branch.dto';

@ApiTags('preferred-branch')
@Controller('restaurants/:restaurantId/preferred-branch')
@UseGuards(SessionAuthGuard)
export class PreferredBranchController {
  constructor(private readonly preferredBranchService: PreferredBranchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Resolve favored branch on restaurant open (nearest covering if none; persists preference)',
  })
  resolve(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.preferredBranchService.resolvePreferredBranch(req.user.id, restaurantId);
  }

  @Put()
  @ApiOperation({
    summary: 'Explicitly set favored branch (menu header / checkout); syncs open cart',
  })
  set(
    @Req() req: AuthenticatedRequest,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: SetPreferredBranchDto,
  ) {
    return this.preferredBranchService.setPreferredBranch(
      req.user.id,
      restaurantId,
      dto.branchId,
    );
  }
}
