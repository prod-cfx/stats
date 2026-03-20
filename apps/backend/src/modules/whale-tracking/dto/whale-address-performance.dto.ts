import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class WhaleTradeHistoryItemDto {
  @ApiProperty({ description: '鲸鱼地址（用户地址）', example: '0xWhaleAddress1' })
  @IsString()
  address!: string

  @ApiProperty({ description: '币种符号，如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol!: string

  @ApiProperty({
    description: '仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导',
    example: 'LONG',
    enum: ['LONG', 'SHORT'],
  })
  @IsString()
  side!: 'LONG' | 'SHORT'

  @ApiProperty({
    description: '持仓大小（原始数值，正数=多头，负数=空头）',
    example: 123.456,
  })
  @IsNumber()
  positionSize!: number

  @ApiProperty({
    description: '持仓名义价值（USD）',
    example: 1_000_000,
  })
  @IsNumber()
  positionValueUsd!: number

  @ApiProperty({
    description: '入场价格',
    example: 50_000,
  })
  @IsNumber()
  entryPrice!: number

  @ApiProperty({
    description: '清算价格',
    example: 45_000,
  })
  @IsNumber()
  liquidationPrice!: number

  @ApiProperty({
    description: '持仓操作类型：1 = 开仓, 2 = 平仓（直接来自 Hyperliquid Whale Alert 数据）',
    enum: [1, 2],
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(2)
  positionAction!: number

  @ApiProperty({
    description: '该持仓变动时间（来自 create_time）',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDateString()
  createTime!: string
}

export class WhaleAssetPerformanceDto {
  @ApiProperty({ description: '币种符号', example: 'BTC' })
  @IsString()
  symbol!: string

  @ApiProperty({
    description:
      '该币种在时间窗口内的累计名义价值（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合',
    example: 5_000_000,
  })
  @IsNumber()
  totalValueUsd!: number

  @ApiProperty({
    description: '该币种在时间窗口内的鲸鱼预警条数（视作成交/开平仓次数的近似值）',
    example: 12,
  })
  @IsInt()
  trades!: number

  @ApiProperty({
    description: '多头方向的预警条数（positionSize > 0）',
    example: 8,
  })
  @IsInt()
  longCount!: number

  @ApiProperty({
    description: '空头方向的预警条数（positionSize < 0）',
    example: 4,
  })
  @IsInt()
  shortCount!: number
}

export class WhaleTraderSummaryPerformanceDto {
  @ApiProperty({ description: '鲸鱼地址（链上地址）', example: '0xWhaleAddress1' })
  @IsString()
  address!: string

  @ApiProperty({
    description:
      '统计使用的回溯天数，例如 7 表示近 7 天内的 Hyperliquid Whale Alert 数据',
    example: 7,
  })
  @IsInt()
  lookbackDays!: number

  @ApiProperty({
    description: '可选的币种过滤条件，若存在则仅统计该币种下的预警记录',
    required: false,
    example: 'BTC',
  })
  @IsString()
  @IsOptional()
  symbolFilter?: string

  @ApiProperty({
    description:
      '时间窗口内的鲸鱼预警总条数（视作成交/开平仓次数的近似值，不代表真实成交笔数）',
    example: 24,
  })
  @IsInt()
  trades!: number

  @ApiProperty({
    description: '时间窗口内涉及的币种数量（去重后的 symbol 数量）',
    example: 3,
  })
  @IsInt()
  positions!: number

  @ApiProperty({
    description:
      '时间窗口内名义价值总和（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合，不代表账户真实资产净值。',
    example: 12_000_000,
  })
  @IsNumber()
  totalValueUsd!: number

  @ApiProperty({
    description: '多头方向的预警条数（positionSize > 0）',
    example: 16,
  })
  @IsInt()
  longCount!: number

  @ApiProperty({
    description: '空头方向的预警条数（positionSize < 0）',
    example: 8,
  })
  @IsInt()
  shortCount!: number

  @ApiProperty({
    description:
      '胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于可视化展示，不代表真实历史胜率。',
    example: 62.5,
  })
  @IsNumber()
  winRatePct!: number

  @ApiProperty({
    description:
      '实现盈亏（USD）。当前实现为基于名义价值与多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。',
    example: 350_000,
  })
  @IsNumber()
  pnlUsd!: number
}

export class WhaleAddressPerformanceResponseDto {
  @ApiProperty({
    description: '地址级别的汇总绩效信息',
    type: () => WhaleTraderSummaryPerformanceDto,
  })
  @ValidateNested()
  @Type(() => WhaleTraderSummaryPerformanceDto)
  summary!: WhaleTraderSummaryPerformanceDto

  @ApiProperty({
    description: '按币种聚合的绩效列表',
    type: () => WhaleAssetPerformanceDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhaleAssetPerformanceDto)
  byAsset!: WhaleAssetPerformanceDto[]

  @ApiProperty({
    description:
      '按时间倒序排列的鲸鱼预警明细列表，可视作该地址在选定时间窗口内的“历史交易”近似记录',
    type: () => WhaleTradeHistoryItemDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhaleTradeHistoryItemDto)
  trades!: WhaleTradeHistoryItemDto[]
}

export class QueryWhaleAddressPerformanceDto {
  @ApiProperty({
    description: '回溯时间范围（天），默认 30 天，最大 365 天',
    required: false,
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(365)
  timeRangeDays?: number

  @ApiProperty({
    description: '币种符号过滤，例如 BTC / ETH；留空表示所有币种',
    required: false,
    example: 'BTC',
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({
    description: '返回的最大明细记录数，默认 200，最大 500',
    required: false,
    example: 200,
    minimum: 1,
    maximum: 500,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(500)
  limit?: number
}

