import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator'

export class VerifyEmailLoginCodeRequestDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ description: '6-digit verification code', example: '123456' })
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string

  @ApiProperty({ required: false, description: '内测码，首次创建用户时必填' })
  @IsOptional()
  @IsString()
  betaCode?: string
}
