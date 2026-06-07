import { AdminMenuType } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AdminMenuPermissionDto {
  @ApiProperty({ description: '菜单/权限节点 ID', example: 'menu_01HXYZ' })
  id!: string

  @ApiProperty({ description: '父级菜单 ID（顶级为 null）', example: null, nullable: true, required: false })
  parentId!: string | null

  @ApiProperty({ description: '菜单名称', example: '用户管理' })
  name!: string

  @ApiProperty({ description: '前端路由（无路由时为 null）', example: '/users', nullable: true, required: false })
  route!: string | null

  @ApiProperty({ description: '菜单图标（无图标时为 null）', example: 'user', nullable: true, required: false })
  icon!: string | null

  @ApiProperty({ description: '排序值', example: 10 })
  sortOrder!: number

  @ApiProperty({ description: '菜单/功能权限 code', nullable: true })
  code!: string | null

  @ApiProperty({ description: '菜单类型', enum: AdminMenuType })
  type!: AdminMenuType

  // 自引用子菜单节点数组：用 lazy type 生成 array of $ref(self)，
  // 避免 additionalProperties 被 dart-dio 误译成非法 BuiltMap<JsonObject>。
  @ApiPropertyOptional({ description: '子菜单节点', type: () => AdminMenuPermissionDto, isArray: true })
  children?: AdminMenuPermissionDto[]
}

export class AdminUserInfoDto {
  @ApiProperty({ description: '用户ID' })
  id!: string

  @ApiProperty({ description: '用户名' })
  username!: string

  @ApiProperty({ description: '昵称', required: false, nullable: true })
  nickName!: string | null

  @ApiProperty({ description: '头像', required: false, nullable: true })
  headPic!: string | null

  @ApiProperty({ description: '菜单树', type: [AdminMenuPermissionDto] })
  menus!: AdminMenuPermissionDto[]

  @ApiProperty({ description: '菜单权限', type: [String] })
  menuPermissions!: string[]

  @ApiProperty({ description: '功能权限', type: [String] })
  featurePermissions!: string[]

  @ApiProperty({ description: 'API权限', type: [String] })
  apiPermissions!: string[]
}
