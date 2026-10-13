import path from 'node:path';
import { config } from 'dotenv';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

config({ path: path.resolve(__dirname, '../../../.env') });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.API_PORT ?? 3001);
}

bootstrap();
