import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterRequestDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickname?: string
}

