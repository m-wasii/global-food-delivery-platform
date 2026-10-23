import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateAvailabilityExceptionDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: true, description: 'Closed for the whole window when true' })
  @IsBoolean()
  isClosed!: boolean;

  @ApiPropertyOptional({ example: 600 })
  @ValidateIf((o: CreateAvailabilityExceptionDto) => !o.isClosed)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  openTimeMinutes?: number;

  @ApiPropertyOptional({ example: 1080 })
  @ValidateIf((o: CreateAvailabilityExceptionDto) => !o.isClosed)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  closeTimeMinutes?: number;

  @ApiPropertyOptional({ example: 'Christmas Day' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;
}
