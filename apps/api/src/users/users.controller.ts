import { Body, Patch, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Read the current customer profile' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Update the current customer profile' })
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(req.user.id, body);
  }
}