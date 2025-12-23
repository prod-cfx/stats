import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator'

export class VerifyEmailRequestDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ description: '6-digit verification code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string

  @ApiProperty({
    description: 'Whether to update user status automatically',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  updateUserStatus?: boolean = true
}


