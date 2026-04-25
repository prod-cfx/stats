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

  @ApiProperty({ required: false, description: '内测码，首次创建用户时必填' })
  @IsOptional()
  @IsString()
  betaCode?: string
}
