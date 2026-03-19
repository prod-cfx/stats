import { MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator'

export class CreateMarketSymbolDto {
  @ApiProperty({ description: '交易对代码', example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty({ message: 'code cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'code must contain only uppercase letters and numbers' })
  code!: string

  @ApiProperty({ description: '基础资产', example: 'BTC' })
  @IsString()
  @IsNotEmpty({ message: 'baseAsset cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'baseAsset must contain only uppercase letters and numbers' })
  baseAsset!: string

  @ApiProperty({ description: '计价资产', example: 'USDT' })
  @IsString()
  @IsNotEmpty({ message: 'quoteAsset cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'quoteAsset must contain only uppercase letters and numbers' })
  quoteAsset!: string

  @ApiProperty({ description: '交易所', example: 'BINANCE' })
  @IsString()
  @IsNotEmpty({ message: 'exchange cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_]+$/, { message: 'exchange must contain only uppercase letters, numbers, and underscores' })
  exchange!: string

  @ApiProperty({ description: '品种类型', enum: MARKET_SYMBOL_TYPES, example: 'CRYPTO' })
  @IsString()
  @IsIn(MARKET_SYMBOL_TYPES as unknown as string[])
  type!: string

  @ApiProperty({ description: '合约形态', enum: MARKET_INSTRUMENT_TYPES, example: 'SPOT' })
  @IsString()
  @IsIn(MARKET_INSTRUMENT_TYPES as unknown as string[])
  instrumentType!: string

  @ApiProperty({ description: '状态', enum: MARKET_SYMBOL_STATUSES, example: 'ACTIVE' })
  @IsString()
  @IsIn(MARKET_SYMBOL_STATUSES as unknown as string[])
  status!: string

  @ApiProperty({ description: '价格精度', example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  precisionPrice!: number

  @ApiProperty({ description: '数量精度', example: 6, minimum: 0 })
  @IsInt()
  @Min(0)
  precisionQuantity!: number

  @ApiPropertyOptional({ description: '最小变动价位（tick size）', example: '0.01', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @Matches(/^\d+(\.\d+)?$/, { message: 'tickSize must be a valid decimal number' })
  tickSize?: string | null

  @ApiPropertyOptional({ description: '最小下单数量（lot size）', example: '0.0001', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @Matches(/^\d+(\.\d+)?$/, { message: 'lotSize must be a valid decimal number' })
  lotSize?: string | null

  @ApiProperty({ description: '是否支持杠杆交易', example: true })
  @IsBoolean()
  isMarginEnabled!: boolean
}

export class UpdateMarketSymbolDto extends PartialType(
  OmitType(CreateMarketSymbolDto, ['code'] as const),
) {}
