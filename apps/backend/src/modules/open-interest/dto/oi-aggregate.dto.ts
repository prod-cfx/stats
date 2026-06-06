import { ApiProperty } from '@nestjs/swagger'

/**
 * 聚合持仓量单行（某交易所）。
 *
 * 字段对齐移动端聚合盘口页模型 `OiRow`
 * （apps/quantify-mobile/lib/data/models/agg_orders_models.dart）。
 */
export class OiAggregateRowDto {
  @ApiProperty({ description: '交易所名称', example: 'Binance' })
  exchange!: string

  @ApiProperty({ description: '未平仓合约数量', example: 659557.3064 })
  qty!: number

  @ApiProperty({ description: '未平仓合约价值(USD)', example: 57437891724.55 })
  usd!: number

  @ApiProperty({ description: '占总持仓量百分比', example: 32.5 })
  pct!: number

  @ApiProperty({ description: '1小时变化百分比', example: 2.27 })
  h1!: number

  @ApiProperty({ description: '4小时变化百分比', example: 2.95 })
  h4!: number

  @ApiProperty({ description: '24小时变化百分比', example: 0.9 })
  h24!: number

  @ApiProperty({ description: '持仓量名义价值(USD)', example: 57437891724.55 })
  oiVol!: number
}

/**
 * 聚合持仓量总计行。
 *
 * 字段对齐移动端 `OiTotal`。
 */
export class OiAggregateTotalDto {
  @ApiProperty({ description: '总未平仓合约数量', example: 1980000.12 })
  qty!: number

  @ApiProperty({ description: '总未平仓合约价值(USD)', example: 172000000000 })
  usd!: number

  @ApiProperty({ description: '24小时变化百分比', example: 1.05 })
  h24!: number
}

/**
 * 某币种的聚合持仓量快照（总计 + 各交易所行）。
 *
 * 字段对齐移动端 `OiSnapshot`。
 */
export class OiAggregateSnapshotDto {
  @ApiProperty({ description: '币种符号', example: 'BTC' })
  symbol!: string

  @ApiProperty({ description: '数据时间戳', example: '2025-12-24T10:00:00.000Z' })
  dataTimestamp!: string

  @ApiProperty({ description: '总计行', type: OiAggregateTotalDto })
  total!: OiAggregateTotalDto

  @ApiProperty({ description: '各交易所行', type: OiAggregateRowDto, isArray: true })
  rows!: OiAggregateRowDto[]
}
