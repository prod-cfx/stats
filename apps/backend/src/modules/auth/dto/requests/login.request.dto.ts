import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class LoginRequestDto {
  @ApiProperty({
    description: 'Email',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description: 'Password',
    example: 'P@ssw0rd123',
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

