import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateAddressDto {
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

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Main St',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1?: string;

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

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  city?: string;

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

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  country?: string;
}
