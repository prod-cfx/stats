import { ApiProperty } from '@nestjs/swagger'

/**
 * 聚合成交量单行（某交易所）。
 *
 * 字段对齐移动端聚合盘口页模型 `VolRow`
 * （apps/quantify-mobile/lib/data/models/agg_orders_models.dart）。
 */
export class AggregatedVolumeRowDto {
  @ApiProperty({ description: '交易所名称', example: 'Binance' })
  exchange!: string

  @ApiProperty({ description: '24h 成交量（USD）', example: 12345678901.5 })
  value!: number
}

/**
 * 某币种的聚合成交量快照（总计 + 各交易所行）。
 *
 * 字段对齐移动端 `VolSnapshot`。
 */
export class AggregatedVolumeSnapshotResponseDto {
  @ApiProperty({ description: '币种符号', example: 'BTC' })
  symbol!: string

  @ApiProperty({ description: '总成交量（USD）', example: 45678901234.5 })
  total!: number

  @ApiProperty({ description: '各交易所行', type: AggregatedVolumeRowDto, isArray: true })
  rows!: AggregatedVolumeRowDto[]
}
