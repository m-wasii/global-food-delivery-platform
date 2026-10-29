import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SetCartBranchDto {
  @ApiProperty({ description: 'Fulfillment branch for this restaurant cart' })
  @IsUUID()
  branchId!: string;
}
