import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Spice Route Kitchen', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'URL slug; generated from name when omitted',
    example: 'spice-route-kitchen',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: ['Pakistani', 'Biryani'],
    description: 'Cuisine tags used by discovery search',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  cuisineTags?: string[];
}
