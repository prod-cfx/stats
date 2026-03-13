import { ApiProperty } from '@nestjs/swagger'

/**
 * 策略实例统计数据 DTO
 */
export class StrategyInstanceStatsDto {
  @ApiProperty({ description: '投入本金 (USDT)', example: 5000.0 })
  investedAmount: number

  @ApiProperty({ description: '当前净值 (USDT)', example: 5860.0 })
  currentValue: number

  @ApiProperty({ description: '累计盈亏 (USDT)', example: 860.0 })
  totalPnl: number

  @ApiProperty({ description: '累计收益率 (%)', example: 17.2 })
  totalPnlRate: number

  @ApiProperty({ description: '今日盈亏 (USDT)', example: 126.4, required: false })
  todayPnl?: number

  @ApiProperty({ description: '今日收益率 (%)', example: 2.5, required: false })
  todayPnlRate?: number

  @ApiProperty({ description: '持仓数量', example: 3 })
  openPositionsCount: number

  @ApiProperty({ description: '已平仓数量', example: 16 })
  closedPositionsCount: number

  @ApiProperty({ 
    description: '平仓总数（用于计算胜率，与 closedPositionsCount 相同）', 
    example: 19 
  })
  totalTradesCount: number

  @ApiProperty({ description: '盈利平仓数', example: 15 })
  winningTradesCount: number

  @ApiProperty({ description: '胜率 (%)', example: 78.95, required: false })
  winRate?: number

  @ApiProperty({ description: '最大回撤 (%)', example: -9.4, required: false })
  maxDrawdown?: number

  @ApiProperty({ description: '夏普比率', example: 1.85, required: false })
  sharpeRatio?: number

  @ApiProperty({ description: '最后更新时间' })
  lastUpdatedAt: Date
}
