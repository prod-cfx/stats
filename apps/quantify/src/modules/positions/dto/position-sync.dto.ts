import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export class TriggerPositionSyncDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '用户策略账户 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '交易所 ID', enum: ['binance', 'okx', 'hyperliquid'] })
  @IsEnum(['binance', 'okx', 'hyperliquid'])
  exchangeId!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty({ description: '市场类型', enum: ['spot', 'perp'] })
  @IsEnum(['spot', 'perp'])
  marketType!: 'spot' | 'perp'
}

export class PositionSyncResultDto {
  @ApiProperty({ description: '用户 ID' })
  userId!: string

  @ApiProperty({ description: '交易所 ID' })
  exchangeId!: string

  @ApiProperty({ description: '市场类型' })
  marketType!: string

  @ApiProperty({ description: '同步是否成功' })
  success!: boolean

  @ApiProperty({ description: '同步时间' })
  syncedAt!: Date

  @ApiProperty({ description: '交易所仓位数量' })
  exchangePositions!: number

  @ApiProperty({ description: '本地仓位数量' })
  localPositions!: number

  @ApiProperty({ description: '差异列表', type: [Object] })
  differences!: Array<{
    symbol: string
    positionSide: string
    exchangeQuantity: string
    localQuantity: string
    difference: string
    action: string
  }>

  @ApiPropertyOptional({ description: '错误信息', type: [String] })
  errors?: string[]
}
