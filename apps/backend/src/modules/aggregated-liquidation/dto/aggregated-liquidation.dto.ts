import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'

export const LIQUIDATION_TIMEFRAMES = ['1h', '4h', '12h', '24h'] as const

export type LiquidationTimeframe = (typeof LIQUIDATION_TIMEFRAMES)[number]

export class LiquidationSummaryItemDto {
  @ApiProperty({
    description: '时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h',
    enum: LIQUIDATION_TIMEFRAMES,
    example: '4h',
  })
  @IsEnum(LIQUIDATION_TIMEFRAMES)
  timeframe: LiquidationTimeframe

  @ApiProperty({
    description: '该时间区间内的总爆仓金额（USD），long + short',
    example: 2.22e8,
  })
  @IsNumber()
  totalUsd: number

  @ApiProperty({
    description: '该时间区间内的多头爆仓金额（USD）',
    example: 1.44e8,
  })
  @IsNumber()
  longUsd: number

  @ApiProperty({
    description: '该时间区间内的空头爆仓金额（USD）',
    example: 7.8e7,
  })
  @IsNumber()
  shortUsd: number
}

export class AggregatedLiquidationSummaryDto {
  @ApiProperty({ description: '币种基础资产，例如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '不同时间区间的爆仓汇总数据',
    type: () => [LiquidationSummaryItemDto],
  })
  items: LiquidationSummaryItemDto[]
}

export class ExchangeLiquidationRowDto {
  @ApiProperty({
    description: '交易所代码或名称，例如 BINANCE / OKX / AGGREGATED / TOTAL',
    example: 'BINANCE',
  })
  @IsString()
  exchange: string

  @ApiProperty({
    description: '币种基础资产，例如 BTC / ETH / ALL',
    example: 'BTC',
  })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h',
    enum: LIQUIDATION_TIMEFRAMES,
    example: '4h',
  })
  @IsEnum(LIQUIDATION_TIMEFRAMES)
  timeframe: LiquidationTimeframe

  @ApiProperty({
    description: '该交易所该时间区间内的总爆仓金额（USD），long + short',
    example: 5.5e7,
  })
  @IsNumber()
  amountUsd: number

  @ApiProperty({
    description: '多头爆仓金额（USD）',
    example: 3.2e7,
  })
  @IsNumber()
  longUsd: number

  @ApiProperty({
    description: '空头爆仓金额（USD）',
    example: 2.3e7,
  })
  @IsNumber()
  shortUsd: number

  @ApiProperty({
    description: '多头占比（0-1），= longUsd / amountUsd',
    example: 0.65,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  longShare?: number

  @ApiProperty({
    description: '是否为 TOTAL 汇总行',
    example: false,
    required: false,
  })
  @IsOptional()
  isTotal?: boolean
}

export class ExchangeLiquidationResponseDto {
  @ApiProperty({ description: '币种基础资产，例如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h',
    enum: LIQUIDATION_TIMEFRAMES,
    example: '4h',
  })
  @IsEnum(LIQUIDATION_TIMEFRAMES)
  timeframe: LiquidationTimeframe

  @ApiProperty({
    description: '按交易所拆分的爆仓数据，第一条通常为 TOTAL 汇总行',
    type: () => [ExchangeLiquidationRowDto],
  })
  rows: ExchangeLiquidationRowDto[]
}

export class GetExchangeLiquidationQueryDto {
  @ApiProperty({ description: '币种基础资产，例如 BTC', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '时间区间/粒度，例如 1h/4h/12h/24h',
    enum: LIQUIDATION_TIMEFRAMES,
    example: '4h',
  })
  @IsEnum(LIQUIDATION_TIMEFRAMES)
  timeframe: LiquidationTimeframe
}

export class GetAggregatedLiquidationSummaryQueryDto {
  @ApiProperty({ description: '币种基础资产，例如 BTC', example: 'BTC' })
  @IsString()
  symbol: string
}







