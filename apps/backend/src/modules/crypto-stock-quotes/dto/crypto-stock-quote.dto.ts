import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 加密股票报价响应 DTO
 */
export class CryptoStockQuoteResponseDto {
  @ApiProperty({ description: '记录 ID' })
  id!: number

  @ApiProperty({ description: '股票代码', example: 'MSTR' })
  symbol!: string

  @ApiPropertyOptional({ description: '股票名称', example: 'MicroStrategy Inc.' })
  name?: string | null

  @ApiPropertyOptional({ description: '交易所代码', example: 'NASDAQ' })
  exchange?: string | null

  @ApiProperty({ description: '当前价格' })
  price!: string

  @ApiPropertyOptional({ description: '开盘价' })
  openPrice?: string | null

  @ApiPropertyOptional({ description: '最高价' })
  highPrice?: string | null

  @ApiPropertyOptional({ description: '最低价' })
  lowPrice?: string | null

  @ApiPropertyOptional({ description: '收盘价（前一交易日）' })
  closePrice?: string | null

  @ApiPropertyOptional({ description: '成交量' })
  volume?: string | null

  @ApiPropertyOptional({ description: '成交额' })
  turnover?: string | null

  @ApiPropertyOptional({ description: '涨跌额' })
  priceChange?: string | null

  @ApiPropertyOptional({ description: '涨跌幅（百分比）' })
  priceChangePercent?: string | null

  @ApiPropertyOptional({ description: '市值' })
  marketCap?: string | null

  @ApiPropertyOptional({ description: '市盈率' })
  peRatio?: string | null

  @ApiPropertyOptional({ description: '52周最高价' })
  high52Week?: string | null

  @ApiPropertyOptional({ description: '52周最低价' })
  low52Week?: string | null

  @ApiProperty({ description: '数据源', example: 'BBX' })
  source!: string

  @ApiProperty({ description: '报价时间戳' })
  quoteTimestamp!: Date

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date
}

/**
 * 查询加密股票报价请求 DTO
 */
export class QueryCryptoStockQuotesDto {
  @ApiPropertyOptional({ description: '股票代码', example: 'MSTR' })
  symbol?: string

  @ApiPropertyOptional({ description: '数据源', example: 'BBX' })
  source?: string

  @ApiPropertyOptional({ description: '开始时间' })
  startTime?: Date

  @ApiPropertyOptional({ description: '结束时间' })
  endTime?: Date

  @ApiPropertyOptional({ description: '返回记录数量限制', example: 100 })
  limit?: number
}

