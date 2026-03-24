import { ExchangeId, MarketType } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

// 仅允许大于 0 的正数
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*(?:\.\d+)?|0*\.0*[1-9]\d*)$/

export class ClosePositionDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '用户策略账户 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '仓位 ID' })
  @IsString()
  @IsNotEmpty()
  positionId!: string

  @ApiProperty({ 
    description: '平仓数量（手数）',
    example: '0.5',
  })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'quantity 必须是大于 0 的数字字符串' })
  quantity!: string

  @ApiProperty({ 
    description: '交易所 ID',
    example: 'binance',
    enum: ExchangeId,
  })
  @IsEnum(ExchangeId, { message: 'exchangeId 必须是有效的交易所ID' })
  exchangeId!: ExchangeId

  @ApiProperty({ 
    description: '市场类型',
    example: 'perp',
    enum: MarketType,
  })
  @IsEnum(MarketType, { message: 'marketType 必须是有效的市场类型' })
  marketType!: MarketType

  @ApiPropertyOptional({ 
    description: '订单备注', 
    example: '用户手动平仓',
  })
  @IsOptional()
  @IsString()
  note?: string
}

export class ClosePositionResponseDto {
  @ApiProperty({ description: '是否成功' })
  success!: boolean

  @ApiProperty({ description: '订单 ID' })
  orderId!: string

  @ApiProperty({ description: '仓位 ID' })
  positionId!: string

  @ApiProperty({ description: '已成交数量' })
  filledQuantity!: string

  @ApiPropertyOptional({ description: '成交均价（市价单可能没有成交价格）' })
  averagePrice?: string

  @ApiProperty({ description: '状态消息' })
  message!: string
}
