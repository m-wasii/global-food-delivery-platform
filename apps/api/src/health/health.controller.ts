import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and dependency checks' })
  @ApiOkResponse({ description: 'API, database and Redis are healthy' })
  @ApiServiceUnavailableResponse({ description: 'One or more dependency checks failed' })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const body = await this.healthService.check();
    if (body.status === 'error') {
      res.status(503);
    }
    return body;
  }
}
