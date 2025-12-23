import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class AdminLoginDto {
  @ApiProperty({ description: '管理员登录用户名', example: 'admin' })
  @IsString()
  @MaxLength(50)
  username!: string

  @ApiProperty({ description: '管理员登录密码' })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string
}

export class AdminRefreshDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  refreshToken!: string
}



