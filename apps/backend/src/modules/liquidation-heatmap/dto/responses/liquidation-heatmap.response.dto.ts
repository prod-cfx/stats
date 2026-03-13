import type { LiquidationHeatmapModelType } from '@/prisma/prisma.types'
import { ApiProperty } from '@nestjs/swagger'

export class LiquidationHeatmapResponseDto {
  @ApiProperty({ description: '快照 ID' })
  snapshotId!: number

  @ApiProperty({ description: '基础标的，例如 BTC' })
  symbol!: string

  @ApiProperty({ description: '交易所代码，例如 BINANCE', nullable: true })
  exchangeCode!: string | null

  @ApiProperty({ description: '完整交易对，例如 BTC/USDT', nullable: true })
  tradingPair!: string | null

  @ApiProperty({ description: '合约类型，例如 PERPETUAL', nullable: true })
  contractType!: string | null

  @ApiProperty({
    description: 'Heatmap 模型类型',
    enum: ['MODEL1', 'MODEL2', 'MODEL3'],
  })
  modelType!: LiquidationHeatmapModelType

  @ApiProperty({ description: '时间粒度，例如 15m/1h', nullable: true })
  timeInterval!: string | null

  @ApiProperty({ description: '数值币种，默认为 USD' })
  valueCurrency!: string

  @ApiProperty({ description: '拉取时间' })
  fetchedAt!: Date

  @ApiProperty({ description: '数据生效起始时间', nullable: true })
  effectiveFrom!: Date | null

  @ApiProperty({ description: '数据生效结束时间', nullable: true })
  effectiveTo!: Date | null

  @ApiProperty({ type: [Number], description: 'Y 轴价格刻度列表' })
  y_axis!: number[]

  @ApiProperty({
    type: [Number],
    isArray: true,
    description: '清算热力值，[xIndex, yIndex, value] 三元组数组',
  })
  liquidation_leverage_data!: [number, number, number][]

  @ApiProperty({
    type: [Number],
    isArray: true,
    description:
      '价格 K 线数据，[timestamp(sec), open, high, low, close, volume] 六元组数组，价格与成交量为字符串形式',
  })
  price_candlesticks!: [number, string, string, string, string, string][]
}


