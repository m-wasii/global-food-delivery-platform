import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ORDER_STATUSES } from '../order-transitions';

export class TransitionOrderDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn([...ORDER_STATUSES])
  toStatus!: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
