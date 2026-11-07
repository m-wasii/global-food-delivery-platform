import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetCourierAvailabilityDto {
  @ApiProperty({
    description:
      'true = courier is online and may receive delivery offers (when dispatch-eligible); false = offline',
  })
  @IsBoolean()
  isOnline!: boolean;
}
