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

export class WhaleHoldingDto {
  @ApiProperty({ description: '鲸鱼地址（用户地址）', example: '0xWhaleAddress1' })
  @IsString()
  userAddress: string

  @ApiProperty({ description: '币种符号，如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导',
    example: 'LONG',
    enum: ['LONG', 'SHORT'],
  })
  @IsString()
  side: 'LONG' | 'SHORT'

  @ApiProperty({
    description: '持仓大小绝对值（方向由 side 字段表示）',
    example: 123.456,
  })
  @IsNumber()
  positionSize: number

  @ApiProperty({
    description: '持仓名义价值（USD）',
    example: 1000000,
  })
  @IsNumber()
  positionValueUsd: number

  @ApiProperty({
    description: '入场价格',
    example: 50000,
  })
  @IsNumber()
  entryPrice: number

  @ApiProperty({
    description: '清算价格（可能为 null）',
    example: 45000,
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  liquidationPrice: number | null

  @ApiProperty({
    description: '未实现盈亏（USD），来自 API 的 pnl 字段',
    example: 12345.67,
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  pnl: number | null

  @ApiProperty({
    description: '收益率（ROE），小数形式，如 0.05 表示 5%',
    example: 0.05,
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  roe: number | null

  @ApiProperty({
    description: '杠杆倍数，如 10 表示 10x 杠杆',
    example: 10,
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  leverage: number | null

  @ApiProperty({
    description: '数据快照时间',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDateString()
  snapshotTime: string
}

export class QueryWhaleHoldingsDto {
  @ApiProperty({
    description: '币种符号过滤，例如 BTC / ETH；留空表示所有币种',
    required: false,
    example: 'BTC',
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({
    description: '仅返回名义价值不低于该数值（USD）的持仓，默认 1_000_000',
    required: false,
    example: 1_000_000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  minPositionValueUsd?: number

  // timeRangeHours 已不再需要，因为 HyperliquidWhalePosition 表只保留最新快照

  @ApiProperty({
    description: '最大返回记录数，默认 100，最大 500',
    required: false,
    example: 100,
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







