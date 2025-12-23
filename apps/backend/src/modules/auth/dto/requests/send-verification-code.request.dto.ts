import { ApiProperty } from '@nestjs/swagger'
import { VerificationCodePurpose } from '@prisma/client'
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator'

export class SendVerificationCodeRequestDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description: 'Purpose of verification code',
    enum: VerificationCodePurpose,
    example: VerificationCodePurpose.EMAIL_VERIFICATION,
  })
  @IsEnum(VerificationCodePurpose)
  @IsNotEmpty()
  purpose: VerificationCodePurpose
}

