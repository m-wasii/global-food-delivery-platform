import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetBranchMenuItemAvailabilityDto {
  @ApiProperty({
    description:
      'true = offered and in stock at this branch; false = offered but out of stock. Delete the row to stop offering.',
  })
  @IsBoolean()
  isAvailable!: boolean;
}
