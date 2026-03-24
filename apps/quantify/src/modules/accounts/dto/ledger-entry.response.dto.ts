import { LedgerEntryType } from '@ai/shared'
import { ApiProperty } from '@nestjs/swagger'

export class LedgerEntryResponseDto {
  @ApiProperty({ description: '流水 ID' })
  id!: string

  @ApiProperty({ description: '账户 ID' })
  userStrategyAccountId!: string

  @ApiProperty({ description: '仓位 ID', nullable: true })
  positionId?: string | null

  @ApiProperty({ description: '流水类型', enum: LedgerEntryType })
  type!: LedgerEntryType

  @ApiProperty({ description: '金额（十进制字符串）' })
  amount!: string

  @ApiProperty({ description: '变更后的余额' })
  balanceAfter!: string

  @ApiProperty({ description: '关联 ID', nullable: true })
  referenceId?: string | null

  @ApiProperty({ description: '描述', nullable: true })
  description?: string | null

  @ApiProperty({ description: '发生时间 ISO 字符串' })
  occurredAt!: string

  @ApiProperty({ description: '元数据', nullable: true })
  meta?: Record<string, unknown> | null
}


