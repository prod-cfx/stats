import { AdminMenuType } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'

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

  // openapi-zod-client currently cannot handle recursive schema refs reliably.
  // Keep OpenAPI output generation-friendly; client side can treat this as unknown and refine at runtime.
  @ApiProperty({ type: 'object', additionalProperties: true })
  children?: unknown
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
