import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBranchDto {
  @ApiProperty({ example: 'Downtown', minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Platform operating city id' })
  @IsUUID()
  operatingCityId!: string;

  @ApiProperty({ example: '12 Mall Road' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1!: string;

  @ApiPropertyOptional({ example: 'Suite 4' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line2?: string;

  @ApiProperty({ example: 'Lahore' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  city!: string;

  @ApiPropertyOptional({ example: 'Punjab' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  region?: string;

  @ApiPropertyOptional({ example: '54000' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  postalCode?: string;

  @ApiProperty({ example: 'PK' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  country!: string;

  @ApiPropertyOptional({ example: 31.5204, description: 'Delivery origin latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 74.3587, description: 'Delivery origin longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 5, description: 'Delivery radius in kilometers' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  deliveryRadiusKm?: number;
}
