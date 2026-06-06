import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterRequestDto {
  @ApiProperty({ description: '注册邮箱', example: 'user@example.com' })
  @IsEmail()
  email!: string

  @ApiProperty({ description: '登录密码（至少 6 位）', example: 'YourPassw0rd!' })
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty({ required: false, description: '昵称（可选）', example: 'Alice' })
  @IsOptional()
  @IsString()
  nickname?: string

  @ApiProperty({ required: false, description: '内测码，首次创建用户时必填' })
  @IsOptional()
  @IsString()
  betaCode?: string
}
