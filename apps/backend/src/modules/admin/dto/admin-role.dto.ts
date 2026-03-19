import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class CreateAdminRoleDto {
  @ApiProperty({
    description: '角色编码（全局唯一，例如 admin、moderator、自定义值）',
    example: 'custom_manager',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9:_-]+$/, { message: '角色编码只能包含小写字母、数字、: _ -' })
  code!: string

  @ApiProperty({ description: '角色名称', example: '管理员' })
  @IsString()
  @MaxLength(50)
  name!: string

  @ApiProperty({ description: '角色描述', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiProperty({ description: '菜单权限 code 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuPermissions?: string[]

  @ApiProperty({ description: '功能权限 code 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featurePermissions?: string[]

  @ApiProperty({ description: 'API 权限标识列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apiPermissions?: string[]
}

export class UpdateAdminRoleDto {
  @ApiProperty({ description: '角色名称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string

  @ApiProperty({ description: '角色描述', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiProperty({ description: '菜单权限 code 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuPermissions?: string[]

  @ApiProperty({ description: '功能权限 code 列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featurePermissions?: string[]

  @ApiProperty({ description: 'API 权限标识列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apiPermissions?: string[]
}


