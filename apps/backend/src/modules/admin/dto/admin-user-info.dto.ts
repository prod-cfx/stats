import { ApiProperty } from '@nestjs/swagger'
import { AdminMenuType } from '@prisma/client'

class AdminMenuPermissionDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ nullable: true, required: false })
  parentId!: string | null

  @ApiProperty()
  name!: string

  @ApiProperty({ nullable: true, required: false })
  route!: string | null

  @ApiProperty({ nullable: true, required: false })
  icon!: string | null

  @ApiProperty()
  sortOrder!: number

  @ApiProperty({ description: '菜单/功能权限 code', nullable: true })
  code!: string | null

  @ApiProperty({ description: '菜单类型', enum: AdminMenuType })
  type!: AdminMenuType

  @ApiProperty({ type: () => [AdminMenuPermissionDto], required: false })
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


