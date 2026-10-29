import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SetPreferredBranchDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;
}
