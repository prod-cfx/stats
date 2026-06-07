import { AdminMenuType } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AdminMenuResponseDto {
  @ApiProperty({ description: '菜单 ID' })
  id!: string

  @ApiPropertyOptional({ description: '父级菜单 ID，顶级为空', nullable: true })
  parentId!: string | null

  @ApiProperty({ description: '菜单类型', enum: AdminMenuType })
  type!: AdminMenuType

  @ApiProperty({ description: '菜单标题' })
  title!: string

  @ApiPropertyOptional({ description: '图标名称', nullable: true })
  icon!: string | null

  @ApiPropertyOptional({ description: '唯一菜单/功能 code', nullable: true })
  code!: string | null

  @ApiPropertyOptional({ description: '前端路由路径', nullable: true })
  path!: string | null

  @ApiPropertyOptional({ description: '描述', nullable: true })
  description!: string | null

  @ApiPropertyOptional({ description: 'i18n key', nullable: true })
  i18nKey!: string | null

  @ApiProperty({ description: '排序值，越大越靠后' })
  sort!: number

  @ApiProperty({ description: '是否在菜单中展示' })
  isShow!: boolean

  @ApiProperty({ description: '创建时间', format: 'date-time' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', format: 'date-time' })
  updatedAt!: Date
}

export class AdminMenuTreeNodeResponseDto extends AdminMenuResponseDto {
  // 自引用子菜单节点数组：用 lazy type 让 swagger 生成 array of $ref(self)，
  // dart-dio 据此映射为 BuiltList<AdminMenuTreeNodeResponseDto>（合法可编译）。
  @ApiProperty({ description: '子菜单节点', type: () => AdminMenuTreeNodeResponseDto, isArray: true })
  children!: AdminMenuTreeNodeResponseDto[]
}
