import { ApiProperty } from '@nestjs/swagger'

export class BetaCodeResponseDto {
  @ApiProperty({ description: '内测码 ID', example: 'beta_01HXYZ' })
  id!: string

  @ApiProperty({ description: '内测码', example: 'WELCOME2026' })
  code!: string

  @ApiProperty({ description: '最大可用次数', example: 100 })
  maxUses!: number

  @ApiProperty({ description: '已使用次数', example: 12 })
  usedCount!: number

  @ApiProperty({ description: '是否启用', example: true })
  isActive!: boolean

  @ApiProperty({ description: '创建时间', example: '2026-06-06T08:00:00.000Z' })
  createdAt!: Date
}
