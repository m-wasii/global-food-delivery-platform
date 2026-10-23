import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Max, MaxLength, Min, MinLength, IsOptional } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({
    description: 'Address label',
    example: 'Home',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label?: string;

  @ApiProperty({
    description: 'Address line 1',
    example: '123 Main St',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1!: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Apt 1',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line2?: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  city!: string;

  @ApiPropertyOptional({
    description: 'State/Region/Province',
    example: 'NY',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  region?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '10001',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  postalCode?: string;

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  country!: string;

  @ApiPropertyOptional({
    description: 'Delivery pin latitude (needed for restaurant discovery)',
    example: 31.5204,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Delivery pin longitude (needed for restaurant discovery)',
    example: 74.3587,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
