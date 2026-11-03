import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ORDER_STATUSES, type OrderStatusValue } from '../order-transitions';

function parseStatusList(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const statuses = raw
    .flatMap((entry) => String(entry).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return statuses.length > 0 ? statuses : undefined;
}

export class ListPartnerOrdersQueryDto {
  @ApiProperty({ description: 'Restaurant whose orders to list (membership required)' })
  @IsUUID()
  restaurantId!: string;

  @ApiPropertyOptional({ description: 'Limit to one branch of the restaurant' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by status. Repeat `status=` or pass a comma-separated list (e.g. PENDING,CONFIRMED).',
    enum: ORDER_STATUSES,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseStatusList(value))
  @IsIn([...ORDER_STATUSES], { each: true })
  status?: OrderStatusValue[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
