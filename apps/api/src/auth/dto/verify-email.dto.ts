import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Raw verification token from the email link',
        example: 'abc123...',
    })
    @IsNotEmpty()
    @IsString()
    token!: string;
}