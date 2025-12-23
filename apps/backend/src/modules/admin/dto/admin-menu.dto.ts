import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AdminMenuType } from '@prisma/client'
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

export class CreateAdminMenuDto {
  @ApiPropertyOptional({ description: '父级菜单 ID，顶级菜单可为空' })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiProperty({ description: '菜单类型' })
  @IsEnum(AdminMenuType)
  type!: AdminMenuType

  @ApiProperty({ description: '菜单标题' })
  @IsString()
  @MaxLength(50)
  title!: string

  @ApiPropertyOptional({ description: '图标名称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string

  @ApiPropertyOptional({ description: '唯一菜单/功能 code', required: false })
  @ValidateIf(o => o.type !== AdminMenuType.DIRECTORY)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string

  @ApiPropertyOptional({ description: '前端路由路径', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string

  @ApiPropertyOptional({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiPropertyOptional({ description: 'i18n key', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  i18nKey?: string

  @ApiPropertyOptional({ description: '排序值，越大越靠后', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sort?: number

  @ApiPropertyOptional({ description: '是否在菜单中展示', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isShow?: boolean
}

export class UpdateAdminMenuDto {
  @ApiPropertyOptional({ description: '父级菜单 ID，顶级菜单可为空' })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiPropertyOptional({ description: '菜单类型' })
  @IsOptional()
  @IsEnum(AdminMenuType)
  type?: AdminMenuType

  @ApiPropertyOptional({ description: '菜单标题' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string

  @ApiPropertyOptional({ description: '图标名称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string

  @ApiPropertyOptional({ description: '唯一菜单/功能 code', required: false })
  @ValidateIf((o, value) => {
    if (o.type !== undefined && o.type !== AdminMenuType.DIRECTORY) {
      return true
    }
    return value !== undefined && value !== null
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsNotEmpty({ message: '非目录菜单必须提供 code' })
  code?: string

  @ApiPropertyOptional({ description: '前端路由路径', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string

  @ApiPropertyOptional({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiPropertyOptional({ description: 'i18n key', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  i18nKey?: string

  @ApiPropertyOptional({ description: '排序值，越大越靠后', required: false })
  @IsOptional()
  @IsInt()
  sort?: number

  @ApiPropertyOptional({ description: '是否在菜单中展示', required: false })
  @IsOptional()
  @IsBoolean()
  isShow?: boolean
}


