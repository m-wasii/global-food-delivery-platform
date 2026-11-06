import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({
    description:
      'Positive amount in the payment currency’s smallest unit (partial or full remainder).',
    example: 500,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Optional ops reason (e.g. requested_by_customer).',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
