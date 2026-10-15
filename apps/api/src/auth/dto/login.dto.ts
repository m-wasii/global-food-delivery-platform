import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  
    @ApiProperty({
        description: 'Customer email (unique - normalized to lowercase on write)',
        example: 'ada@example.com'
    })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({
        description: 'Password (never logged or returned)',
        example: 'correct-horse-battery',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @ApiPropertyOptional({
        description: 'If true, issue long-lived session cookie. default: false',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    rememberMe?: boolean;
}