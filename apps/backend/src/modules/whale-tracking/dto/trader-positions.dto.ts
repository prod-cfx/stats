import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

/**
 * 杠杆信息 DTO
 */
export class LeverageDto {
  @ApiProperty({
    description: '杠杆类型',
    enum: ['cross', 'isolated'],
    example: 'cross',
  })
  @IsString()
  type!: 'cross' | 'isolated'

  @ApiProperty({
    description: '杠杆倍数',
    example: 10,
  })
  @IsNumber()
  value!: number
}

/**
 * 永续合约持仓详情 DTO
 */
export class PerpPositionDto {
  @ApiProperty({
    description: '币种符号',
    example: 'BTC',
  })
  @IsString()
  coin!: string

  @ApiProperty({
    description: '仓位方向',
    enum: ['LONG', 'SHORT'],
    example: 'SHORT',
  })
  @IsString()
  side!: 'LONG' | 'SHORT'

  @ApiProperty({
    description: '持仓数量（负数表示空头）',
    example: -1899.07241,
  })
  @IsNumber()
  size!: number

  @ApiProperty({
    description: '入场价格',
    example: 88077.9,
  })
  @IsNumber()
  entryPrice!: number

  @ApiProperty({
    description: '标记价格（当前市场价）',
    example: 87429.0,
  })
  @IsNumber()
  markPrice!: number

  @ApiProperty({
    description: '清算价格',
    example: 97656.0,
  })
  @IsNumber()
  liquidationPrice!: number

  @ApiProperty({
    description: '持仓价值（USD）',
    example: 166034001.73,
  })
  @IsNumber()
  positionValue!: number

  @ApiProperty({
    description: '已用保证金（USD）',
    example: 16603400.17,
  })
  @IsNumber()
  marginUsed!: number

  @ApiProperty({
    description: '杠杆信息',
    type: () => LeverageDto,
  })
  @ValidateNested()
  @Type(() => LeverageDto)
  leverage!: LeverageDto

  @ApiProperty({
    description: '未实现盈亏（USD）',
    example: 1232483.39,
  })
  @IsNumber()
  unrealizedPnl!: number

  @ApiProperty({
    description: '未实现盈亏百分比（%）',
    example: 7.42,
  })
  @IsNumber()
  unrealizedPnlPercent!: number

  @ApiProperty({
    description: '累计资金费率（USD）',
    example: 32146.82,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  fundingRate?: number

  @ApiProperty({
    description: 'ROI（%）',
    example: 7.42,
  })
  @IsNumber()
  roi!: number
}

/**
 * 现货余额详情 DTO
 */
export class SpotBalanceDto {
  @ApiProperty({
    description: '币种符号',
    example: 'XAUT',
  })
  @IsString()
  coin!: string

  @ApiProperty({
    description: '总余额',
    example: 0.0027915,
  })
  @IsNumber()
  total!: number

  @ApiProperty({
    description: '挂单锁定金额',
    example: 0,
  })
  @IsNumber()
  hold!: number

  @ApiProperty({
    description: '可用余额',
    example: 0.0027915,
  })
  @IsNumber()
  available!: number

  @ApiProperty({
    description: '价值（USD）',
    example: 12.09,
  })
  @IsNumber()
  value!: number
}

/**
 * 鲸鱼交易者持仓详情响应 DTO
 */
export class TraderPositionsResponseDto {
  @ApiProperty({
    description: '永续合约持仓列表',
    type: () => PerpPositionDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerpPositionDto)
  perp!: PerpPositionDto[]

  @ApiProperty({
    description: '现货余额列表',
    type: () => SpotBalanceDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpotBalanceDto)
  spot!: SpotBalanceDto[]
}

/**
 * 查询持仓详情参数 DTO
 */
export class QueryTraderPositionsDto {
  @ApiProperty({
    description: '持仓类型筛选',
    enum: ['perp', 'spot', 'all'],
    required: false,
    example: 'all',
  })
  @IsOptional()
  @IsEnum(['perp', 'spot', 'all'])
  type?: 'perp' | 'spot' | 'all'

  @ApiProperty({
    description: '是否跳过缓存，强制实时查询',
    required: false,
    example: false,
  })
  @IsOptional()
  skipCache?: boolean
}
