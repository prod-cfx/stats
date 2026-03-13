import { ApiProperty } from '@nestjs/swagger'

export class StrategyAccountResponseDto {
  @ApiProperty({ description: '账户 ID' })
  id!: string

  @ApiProperty({ description: '用户 ID' })
  userId!: string

  @ApiProperty({ description: '策略 ID' })
  strategyId!: string

  @ApiProperty({ description: '策略名称', nullable: true })
  strategyName?: string | null

  @ApiProperty({ description: '策略版本', nullable: true })
  strategyVersion?: string | null

  @ApiProperty({ description: '基础货币' })
  baseCurrency!: string

  @ApiProperty({ description: '初始资金' })
  initialBalance!: string

  @ApiProperty({ description: '可用余额' })
  balance!: string

  @ApiProperty({ description: '账户权益（余额 + 未实现盈亏）' })
  equity!: string

  @ApiProperty({ description: '累计已实现盈亏' })
  totalRealizedPnl!: string

  @ApiProperty({ description: '未实现盈亏汇总' })
  totalUnrealizedPnl!: string

  @ApiProperty({ description: '创建时间' })
  createdAt!: string

  @ApiProperty({ description: '更新时间' })
  updatedAt!: string

  @ApiProperty({
    description: '最近一次日度收益（如存在）',
    nullable: true,
  })
  latestDailyStat?: {
    date: string
    equityEnd: string
    realizedPnl: string
    unrealizedPnl: string
  } | null
}


