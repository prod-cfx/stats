import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator'

export class VerifyPasswordResetRequestDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ description: '6-digit reset code', example: '654321' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string

  @ApiProperty({
    description: 'New password',
    example: 'P@ssw0rd123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string
}


