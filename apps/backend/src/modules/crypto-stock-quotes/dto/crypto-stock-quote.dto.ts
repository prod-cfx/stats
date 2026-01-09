import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

/**
 * 加密股票报价响应 DTO
 */
export class CryptoStockQuoteResponseDto {
  @ApiProperty({ description: '记录 ID' })
  id!: number

  @ApiProperty({ description: '股票代码', example: 'MSTR' })
  symbol!: string

  @ApiPropertyOptional({ description: '股票名称', example: 'MicroStrategy Inc.', nullable: true })
  name?: string | null

  @ApiPropertyOptional({ description: '交易所代码', example: 'NASDAQ', nullable: true })
  exchange?: string | null

  @ApiProperty({ description: '当前价格' })
  price!: string

  @ApiPropertyOptional({ description: '开盘价', nullable: true })
  openPrice?: string | null

  @ApiPropertyOptional({ description: '最高价', nullable: true })
  highPrice?: string | null

  @ApiPropertyOptional({ description: '最低价', nullable: true })
  lowPrice?: string | null

  @ApiPropertyOptional({ description: '收盘价（前一交易日）', nullable: true })
  closePrice?: string | null

  @ApiPropertyOptional({ description: '成交量', nullable: true })
  volume?: string | null

  @ApiPropertyOptional({ description: '成交额', nullable: true })
  turnover?: string | null

  @ApiPropertyOptional({ description: '涨跌额', nullable: true })
  priceChange?: string | null

  @ApiPropertyOptional({ description: '涨跌幅（百分比）', nullable: true })
  priceChangePercent?: string | null

  @ApiPropertyOptional({ description: '市值', nullable: true })
  marketCap?: string | null

  @ApiPropertyOptional({ description: '市盈率', nullable: true })
  peRatio?: string | null

  @ApiPropertyOptional({ description: '52周最高价', nullable: true })
  high52Week?: string | null

  @ApiPropertyOptional({ description: '52周最低价', nullable: true })
  low52Week?: string | null

  @ApiPropertyOptional({
    description: '底层加密资产符号（例如 BTC、ETH、USDC），用于币股联动视图',
    example: 'BTC',
    nullable: true,
  })
  assetSymbol?: string | null

  @ApiPropertyOptional({
    description: '底层加密资产 Logo URL',
    example: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    nullable: true,
  })
  assetLogoUrl?: string | null

  @ApiPropertyOptional({
    description: '公司 Logo URL',
    example: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/MicroStrategy_logo.svg',
    nullable: true,
  })
  companyLogoUrl?: string | null

  @ApiPropertyOptional({
    description: '持有的加密资产名义价值（可带货币符号，前端可根据需要自行解析）',
    example: '$58.14B',
    nullable: true,
  })
  holdingsValue?: string | null

  @ApiPropertyOptional({
    description: '持有的加密资产数量描述（可包含单位和简写，例如 "671.27K BTC"）',
    example: '671.27K BTC',
    nullable: true,
  })
  holdingsAmount?: string | null

  @ApiPropertyOptional({
    description: 'mNAV（市值/净资产比），字符串形式，前端可按需解析为数值',
    example: '0.83',
    nullable: true,
  })
  mNav?: string | null

  @ApiPropertyOptional({
    description: '公司介绍文案段落列表（用于前端弹窗展示）',
    type: [String],
  })
  infoParagraphs?: string[]

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
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiPropertyOptional({ description: '数据源', example: 'BBX' })
  @IsOptional()
  @IsString()
  source?: string

  @ApiPropertyOptional({
    description: '开始时间（ISO 8601 格式）',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '开始时间必须是有效的日期' })
  startTime?: Date

  @ApiPropertyOptional({
    description: '结束时间（ISO 8601 格式）',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '结束时间必须是有效的日期' })
  endTime?: Date

  @ApiPropertyOptional({
    description: '返回记录数量限制（最大 500）',
    example: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '返回数量必须是整数' })
  @Min(1, { message: '返回数量必须大于或等于 1' })
  @Max(500, { message: '返回数量不能超过 500' })
  limit?: number
}

/**
 * 查询最新加密股票报价请求 DTO（用于 /crypto-stock-quotes/latest）
 */
export class GetLatestCryptoStockQuotesQueryDto {
  @ApiPropertyOptional({
    description: '股票代码列表，支持 CSV 或重复 query 参数形式',
    example: 'MSTR,COIN,MARA',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .map(v => String(v).trim())
        .filter(v => v.length > 0)
        .map(v => v.toUpperCase())
    }
    if (typeof value === 'string') {
      if (!value.trim()) return undefined
      return value
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    }
    return undefined
  })
  @IsArray()
  @ArrayMaxSize(100, { message: 'symbols 数量不能超过 100 个' })
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({
    description: '数据源标识，例如：BBX',
    example: 'BBX',
  })
  @IsOptional()
  @IsString()
  @IsIn(['BBX'], { message: 'source 仅支持: BBX' })
  source?: string
}
