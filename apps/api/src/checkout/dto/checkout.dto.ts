import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillment!: 'DELIVERY' | 'PICKUP';

  @ApiPropertyOptional({
    description: 'Required for DELIVERY. Ignored for PICKUP.',
  })
  @ValidateIf((o: CheckoutDto) => o.fulfillment === 'DELIVERY')
  @IsUUID()
  deliveryAddressId?: string;

  @ApiPropertyOptional({
    description:
      'Address used during discovery/browse. When it matches deliveryAddressId, radius is not re-checked.',
  })
  @IsOptional()
  @IsUUID()
  discoveryAddressId?: string;

  @ApiPropertyOptional({
    description:
      'Optional promotion code. Evaluated server-side; invalid or overused codes are rejected.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promoCode?: string;
}
