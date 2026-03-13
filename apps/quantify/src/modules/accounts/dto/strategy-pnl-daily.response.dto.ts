import { ApiProperty } from '@nestjs/swagger'

export class StrategyPnlDailyResponseDto {
  @ApiProperty({ description: '记录 ID' })
  id!: string

  @ApiProperty({ description: '账户 ID' })
  userStrategyAccountId!: string

  @ApiProperty({ description: '日期 (UTC)' })
  date!: string

  @ApiProperty({ description: '期初权益' })
  equityStart!: string

  @ApiProperty({ description: '期末权益' })
  equityEnd!: string

  @ApiProperty({ description: '已实现盈亏' })
  realizedPnl!: string

  @ApiProperty({ description: '未实现盈亏' })
  unrealizedPnl!: string

  @ApiProperty({ description: '期间入金' })
  deposits!: string

  @ApiProperty({ description: '期间出金' })
  withdrawals!: string

  @ApiProperty({ description: '最大回撤' })
  maxDrawdown!: string
}



