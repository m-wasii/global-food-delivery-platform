import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterMediaDto {
  @ApiProperty({
    example: 'https://cdn.example.com/biryani.jpg',
    description: 'Public HTTPS URL registered via the active media provider',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  @MaxLength(127)
  mimeType?: string;

  @ApiPropertyOptional({ example: 102400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  byteSize?: number;
}
