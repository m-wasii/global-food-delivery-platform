import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CANCEL_REASONS } from '../cancellation';
import { ORDER_STATUSES } from '../order-transitions';

export class TransitionOrderDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn([...ORDER_STATUSES])
  toStatus!: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({
    enum: CANCEL_REASONS,
    description: 'Required when toStatus is CANCELLED',
  })
  @ValidateIf((dto: TransitionOrderDto) => dto.toStatus === 'CANCELLED')
  @IsIn([...CANCEL_REASONS])
  cancelReason?: (typeof CANCEL_REASONS)[number];

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional free-text note (appended after cancelReason on cancel)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
