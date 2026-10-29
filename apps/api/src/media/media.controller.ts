import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard';
import { MediaService } from './media.service';
import { RegisterMediaDto } from './dto/register-media.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Register media via the active storage provider (HTTPS URL for v1)',
  })
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterMediaDto) {
    return this.mediaService.registerExternalUrl(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a media asset by id' })
  getById(@Param('id') id: string) {
    return this.mediaService.getById(id);
  }
}
