import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const body = await this.healthService.check();
    if (body.status === 'error') {
      res.status(503);
    }
    return body;
  }
}
