import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  
    @ApiProperty({
        description: 'Customer email (unique - normalized to lowercase on write)',
        example: 'ada@example.com'
    })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({
        description: 'Display name',
        example: 'Ada Lovelace',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(100)
    name!: string;

    @ApiProperty({
        description: 'Password (never logged or returned)',
        example: 'correct-horse-battery',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password!: string;
}