import { ApiProperty } from '@nestjs/swagger'

/**
 * Ticker 实时行情广播 DTO
 * 整合 K 线最新价格 + 数据库 ticker 数据
 */
export class TickerBroadcastDto {
  @ApiProperty({ example: 'BTC', description: '币种符号（基础币）' })
  symbol: string

  @ApiProperty({ example: 50123.45, description: '当前价格（来自 K 线 1m close）', nullable: true })
  currentPrice: number | null

  @ApiProperty({ example: 50100.0, description: '指数价格', nullable: true })
  indexPrice: number | null

  @ApiProperty({ example: 0.0001, description: '资金费率', nullable: true })
  fundingRate: number | null

  @ApiProperty({ example: 2.34, description: '24小时价格变化百分比', nullable: true })
  priceChangePercent24h: number | null

  @ApiProperty({ example: 12345678.9, description: '24小时成交量（USD）', nullable: true })
  volumeUsd: number | null

  @ApiProperty({ example: 98765432.1, description: '持仓量（USD）', nullable: true })
  openInterestUsd: number | null

  @ApiProperty({ example: 1704067200000, description: '时间戳（毫秒）' })
  timestamp: number
}
