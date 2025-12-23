import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class AdminAssignedRoleDto {
  @ApiProperty({ description: '角色 ID' })
  id!: string

  @ApiProperty({ description: '角色编码' })
  code!: string

  @ApiProperty({ description: '角色名称' })
  name!: string

  @ApiProperty({ description: '角色描述', required: false, nullable: true })
  description?: string | null
}

export class AdminUserDto {
  @ApiProperty({ description: '管理员 ID' })
  id!: string

  @ApiProperty({ description: '登录用户名' })
  username!: string

  @ApiProperty({ description: '昵称', nullable: true })
  nickName!: string | null

  @ApiProperty({ description: '邮箱', nullable: true })
  email!: string | null

  @ApiProperty({ description: '头像 URL', nullable: true })
  avatarUrl!: string | null

  @ApiProperty({ description: '手机号', nullable: true })
  phone!: string | null

  @ApiProperty({ description: '是否冻结' })
  isFrozen!: boolean

  @ApiProperty({ description: '关联角色列表', type: [AdminAssignedRoleDto], default: [] })
  roles!: AdminAssignedRoleDto[]
}

export class CreateAdminUserDto {
  @ApiProperty({ description: '登录用户名', example: 'admin' })
  @IsString()
  @MaxLength(50)
  username!: string

  @ApiProperty({ description: '登录密码', example: 'StrongP@ssw0rd' })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string

  @ApiProperty({ description: '昵称', required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string

  @ApiProperty({ description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string

  @ApiProperty({ description: '头像 URL', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  avatarUrl?: string

  @ApiProperty({ description: '手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string

  @ApiProperty({ description: '初始角色 ID 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[]
}

export class UpdateAdminUserDto {
  @ApiProperty({ description: '昵称', required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string

  @ApiProperty({ description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string

  @ApiProperty({ description: '头像 URL', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  avatarUrl?: string

  @ApiProperty({ description: '手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string

  @ApiProperty({ description: '是否冻结', required: false })
  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean

  @ApiProperty({ description: '角色 ID 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[]
}

