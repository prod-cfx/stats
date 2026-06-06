import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AdminRoleResponseDto {
  @ApiProperty({ description: '角色 ID' })
  id!: string

  @ApiProperty({ description: '角色编码' })
  code!: string

  @ApiProperty({ description: '角色名称' })
  name!: string

  @ApiPropertyOptional({ description: '角色描述', nullable: true })
  description!: string | null

  @ApiProperty({ description: '菜单权限 code 列表', type: [String] })
  menuPermissions!: string[]

  @ApiProperty({ description: '功能权限 code 列表', type: [String] })
  featurePermissions!: string[]

  @ApiProperty({ description: 'API 权限 code 列表', type: [String] })
  apiPermissions!: string[]

  @ApiProperty({ description: '创建时间', format: 'date-time' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', format: 'date-time' })
  updatedAt!: Date
}
