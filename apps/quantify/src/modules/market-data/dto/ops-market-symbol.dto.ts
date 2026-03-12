import { MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator'

export class CreateMarketSymbolDto {
  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮?, example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty({ message: 'code cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'code must contain only uppercase letters and numbers' })
  code!: string

  @ApiProperty({ description: '鍩虹璧勪骇', example: 'BTC' })
  @IsString()
  @IsNotEmpty({ message: 'baseAsset cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'baseAsset must contain only uppercase letters and numbers' })
  baseAsset!: string

  @ApiProperty({ description: '璁′环璧勪骇', example: 'USDT' })
  @IsString()
  @IsNotEmpty({ message: 'quoteAsset cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]+$/, { message: 'quoteAsset must contain only uppercase letters and numbers' })
  quoteAsset!: string

  @ApiProperty({ description: '浜ゆ槗鎵€', example: 'BINANCE' })
  @IsString()
  @IsNotEmpty({ message: 'exchange cannot be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_]+$/, { message: 'exchange must contain only uppercase letters, numbers, and underscores' })
  exchange!: string

  @ApiProperty({ description: '鍝佺绫诲瀷', enum: MARKET_SYMBOL_TYPES, example: 'CRYPTO' })
  @IsString()
  @IsIn(MARKET_SYMBOL_TYPES as unknown as string[])
  type!: string

  @ApiProperty({ description: '鍚堢害褰㈡€?, enum: MARKET_INSTRUMENT_TYPES, example: 'SPOT' })
  @IsString()
  @IsIn(MARKET_INSTRUMENT_TYPES as unknown as string[])
  instrumentType!: string

  @ApiProperty({ description: '鐘舵€?, enum: MARKET_SYMBOL_STATUSES, example: 'ACTIVE' })
  @IsString()
  @IsIn(MARKET_SYMBOL_STATUSES as unknown as string[])
  status!: string

  @ApiProperty({ description: '浠锋牸绮惧害', example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  precisionPrice!: number

  @ApiProperty({ description: '鏁伴噺绮惧害', example: 6, minimum: 0 })
  @IsInt()
  @Min(0)
  precisionQuantity!: number

  @ApiPropertyOptional({ description: '鏈€灏忓彉鍔ㄤ环浣嶏紙tick size锛?, example: '0.01', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @Matches(/^\d+(\.\d+)?$/, { message: 'tickSize must be a valid decimal number' })
  tickSize?: string | null

  @ApiPropertyOptional({ description: '鏈€灏忎笅鍗曟暟閲忥紙lot size锛?, example: '0.0001', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @Matches(/^\d+(\.\d+)?$/, { message: 'lotSize must be a valid decimal number' })
  lotSize?: string | null

  @ApiProperty({ description: '鏄惁鏀寔鏉犳潌浜ゆ槗', example: true })
  @IsBoolean()
  isMarginEnabled!: boolean
}

export class UpdateMarketSymbolDto extends PartialType(
  OmitType(CreateMarketSymbolDto, ['code'] as const),
) {}
