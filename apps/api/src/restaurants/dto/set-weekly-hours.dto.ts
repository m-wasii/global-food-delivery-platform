import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WeeklyHoursEntryDto {
  @ApiProperty({ example: 1, description: '0=Sunday … 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: 600, description: 'Minutes from midnight (10:00 = 600)' })
  @IsInt()
  @Min(0)
  @Max(1439)
  openTimeMinutes!: number;

  @ApiProperty({ example: 1320, description: 'Minutes from midnight (22:00 = 1320)' })
  @IsInt()
  @Min(0)
  @Max(1439)
  closeTimeMinutes!: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  isClosed!: boolean;
}

export class SetWeeklyHoursDto {
  @ApiProperty({ type: [WeeklyHoursEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WeeklyHoursEntryDto)
  hours!: WeeklyHoursEntryDto[];
}
