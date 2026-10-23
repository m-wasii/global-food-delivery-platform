import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: 'Spice Route Kitchen', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
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

  @ApiPropertyOptional({ example: ['Pakistani', 'Biryani'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  cuisineTags?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cover MediaAsset id from POST /media, or null to clear',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  coverMediaId?: string | null;
}
