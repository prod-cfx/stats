import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class AdminProfileDto {
  @ApiProperty({ description: '管理员 ID' })
  id!: string

  @ApiProperty({ description: '登录用户名' })
  username!: string

  @ApiProperty({ description: '邮箱', required: false, nullable: true })
  email?: string | null

  @ApiProperty({ description: '昵称', required: false, nullable: true })
  nickName?: string | null

  @ApiProperty({ description: '账号是否冻结' })
  isFrozen!: boolean

  @ApiProperty({ description: '拥有的菜单权限编码', type: [String] })
  menuPermissions!: string[]
}

export class AdminAuthResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken!: string

  @ApiProperty({ description: '刷新令牌', required: false })
  refreshToken?: string

  @ApiProperty({ description: '访问令牌过期时间（字符串，例如 30m）', required: false })
  expiresIn?: string

  @ApiProperty({ description: '管理员信息', type: () => AdminProfileDto })
  admin!: AdminProfileDto
}

export class AdminRegisterDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsString()
  @MaxLength(50)
  username!: string

  @ApiProperty({ description: '密码', example: 'StrongP@ssw0rd' })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string

  @ApiProperty({ description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string

  @ApiProperty({ description: '昵称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string

  @ApiProperty({ description: '初始角色编码列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[]
}
