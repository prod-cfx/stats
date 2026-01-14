import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator'

/**
 * 永续合约账户快照 DTO
 */
export class SnapshotPerpDto {
  @ApiProperty({
    description: '账户总价值（USD）',
    example: 792013.1,
  })
  @IsNumber()
  accountValue!: number

  @ApiProperty({
    description: '已用保证金（USD）',
    example: 719000.0,
  })
  @IsNumber()
  totalMarginUsed!: number

  @ApiProperty({
    description: '总持仓名义价值（USD）',
    example: 31034500.0,
  })
  @IsNumber()
  totalPositionValue!: number

  @ApiProperty({
    description: '可提取金额（USD）',
    example: 73015.45,
  })
  @IsNumber()
  withdrawable!: number

  @ApiProperty({
    description: '保证金使用率（%）',
    example: 90.78,
  })
  @IsNumber()
  marginUsagePercent!: number

  @ApiProperty({
    description: '杠杆倍数',
    example: 39.18,
  })
  @IsNumber()
  leverageRatio!: number

  @ApiProperty({
    description: '未实现盈亏（USD）',
    example: -54885.83,
  })
  @IsNumber()
  unrealizedPnl!: number

  @ApiProperty({
    description: 'ROI（%）',
    example: -7.63,
  })
  @IsNumber()
  roi!: number
}

/**
 * 现货余额项 DTO
 */
export class SpotBalanceItemDto {
  @ApiProperty({
    description: '币种符号',
    example: 'XAUT',
  })
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
    description: '价值（USD）',
    example: 12.09,
  })
  @IsNumber()
  value!: number

  @ApiProperty({
    description: '占比（%）',
    example: 98.96,
  })
  @IsNumber()
  sharePercent!: number
}

/**
 * 现货账户快照 DTO
 */
export class SnapshotSpotDto {
  @ApiProperty({
    description: '现货总价值（USD）',
    example: 12.2,
  })
  @IsNumber()
  totalValue!: number

  @ApiProperty({
    description: '现货余额列表',
    type: () => SpotBalanceItemDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpotBalanceItemDto)
  balances!: SpotBalanceItemDto[]
}

/**
 * 账户汇总快照 DTO
 */
export class SnapshotTotalDto {
  @ApiProperty({
    description: '账户总价值（永续 + 现货，USD）',
    example: 792025.3,
  })
  @IsNumber()
  accountValue!: number

  @ApiProperty({
    description: '永续合约占比（%）',
    example: 99.998,
  })
  @IsNumber()
  perpPercent!: number

  @ApiProperty({
    description: '现货占比（%）',
    example: 0.002,
  })
  @IsNumber()
  spotPercent!: number
}

/**
 * 鲸鱼交易者账户快照响应 DTO
 */
export class TraderSnapshotResponseDto {
  @ApiProperty({
    description: '永续合约账户快照',
    type: () => SnapshotPerpDto,
  })
  @ValidateNested()
  @Type(() => SnapshotPerpDto)
  perp!: SnapshotPerpDto

  @ApiProperty({
    description: '现货账户快照',
    type: () => SnapshotSpotDto,
  })
  @ValidateNested()
  @Type(() => SnapshotSpotDto)
  spot!: SnapshotSpotDto

  @ApiProperty({
    description: '账户汇总数据',
    type: () => SnapshotTotalDto,
  })
  @ValidateNested()
  @Type(() => SnapshotTotalDto)
  total!: SnapshotTotalDto
}

/**
 * 查询账户快照参数 DTO
 */
export class QueryTraderSnapshotDto {
  @ApiProperty({
    description: '是否跳过缓存，强制实时查询',
    required: false,
    example: false,
  })
  @IsOptional()
  skipCache?: boolean
}
