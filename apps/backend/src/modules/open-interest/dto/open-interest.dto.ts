import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

/**
 * 持仓量数据 DTO
 */
export class OpenInterestDto {
  @ApiProperty({ description: '交易所名称，"All"表示所有交易所汇总', example: 'All' })
  @IsString()
  exchange: string

  @ApiProperty({ description: '币种符号', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({ description: '未平仓合约价值(USD)', example: 57437891724.5572 })
  @IsNumber()
  open_interest_usd: number

  @ApiProperty({ description: '未平仓合约数量', example: 659557.3064 })
  @IsNumber()
  open_interest_quantity: number

  @ApiProperty({ 
    description: '稳定币本位未平仓合约价值(USD)', 
    example: 48920274435.15,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_by_stable_coin_margin?: number

  @ApiProperty({ 
    description: '币本位未平仓合约数量', 
    example: 97551.2547,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_quantity_by_coin_margin?: number

  @ApiProperty({ 
    description: '稳定币本位未平仓合约数量', 
    example: 562006.0517,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_quantity_by_stable_coin_margin?: number

  @ApiProperty({ 
    description: '5分钟内未平仓合约变化百分比', 
    example: 0.34,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_5m?: number

  @ApiProperty({ 
    description: '15分钟内未平仓合约变化百分比', 
    example: 0.59,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_15m?: number

  @ApiProperty({ 
    description: '30分钟内未平仓合约变化百分比', 
    example: 1.42,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_30m?: number

  @ApiProperty({ 
    description: '1小时内未平仓合约变化百分比', 
    example: 2.27,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_1h?: number

  @ApiProperty({ 
    description: '4小时内未平仓合约变化百分比', 
    example: 2.95,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_4h?: number

  @ApiProperty({ 
    description: '24小时内未平仓合约变化百分比', 
    example: 0.9,
    required: false 
  })
  @IsNumber()
  @IsOptional()
  open_interest_change_percent_24h?: number

  @ApiProperty({ 
    description: '数据时间戳', 
    example: '2025-12-24T10:00:00Z',
    required: false 
  })
  @IsDateString()
  @IsOptional()
  data_timestamp?: string
}

/**
 * 创建持仓量数据 DTO
 */
export class CreateOpenInterestDto extends OpenInterestDto {
  @ApiProperty({ description: '数据时间戳', example: '2025-12-24T10:00:00Z' })
  @IsDateString()
  data_timestamp: string
}

/**
 * 查询持仓量数据 DTO
 */
export class QueryOpenInterestDto {
  @ApiProperty({ description: '交易所名称', required: false, example: 'All' })
  @IsString()
  @IsOptional()
  exchange?: string

  @ApiProperty({ description: '币种符号', required: false, example: 'BTC' })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({ description: '开始时间', required: false, example: '2025-12-24T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  startTime?: string

  @ApiProperty({ description: '结束时间', required: false, example: '2025-12-24T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string

  @ApiProperty({
    description: '每页数量',
    required: false,
    example: 100,
    default: 100,
    minimum: 1,
    maximum: 1000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number

  @ApiProperty({
    description: '偏移量',
    required: false,
    example: 0,
    default: 0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number
}

/**
 * 查询结果响应 DTO
 */
export class QueryOpenInterestResponseDto {
  @ApiProperty({ description: '数据列表', type: [OpenInterestDto] })
  data: OpenInterestDto[]

  @ApiProperty({ description: '总数', example: 1000 })
  total: number

  @ApiProperty({ description: '每页数量', example: 100 })
  limit: number

  @ApiProperty({ description: '偏移量', example: 0 })
  offset: number
}

/**
 * 统计数据响应 DTO
 */
export class OpenInterestStatsDto {
  @ApiProperty({ description: '币种符号', example: 'BTC' })
  symbol: string

  @ApiProperty({ description: '开始时间' })
  startTime: Date

  @ApiProperty({ description: '结束时间' })
  endTime: Date

  @ApiProperty({ description: '数据点数量', example: 144 })
  dataPoints: number

  @ApiProperty({ description: '最大值', example: 58000000000 })
  max: number

  @ApiProperty({ description: '最小值', example: 57000000000 })
  min: number

  @ApiProperty({ description: '平均值', example: 57500000000 })
  avg: number

  @ApiProperty({ description: '最新值', example: 57800000000 })
  latest: number

  @ApiProperty({ description: '最早值', example: 57200000000 })
  earliest: number

  @ApiProperty({ description: '变化量', example: 600000000 })
  change: number

  @ApiProperty({ description: '变化百分比', example: 1.05 })
  changePercent: number
}
