import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

const EXCHANGE_IDS = ['binance', 'okx', 'hyperliquid'] as const
const MARKET_TYPES = ['spot', 'perp'] as const

export class CreateAccountExchangeAccountDto {
  @ApiProperty({ enum: EXCHANGE_IDS })
  @IsIn(EXCHANGE_IDS)
  exchangeId!: typeof EXCHANGE_IDS[number]

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean

  @ApiPropertyOptional({ enum: MARKET_TYPES, default: 'spot' })
  @IsOptional()
  @IsIn(MARKET_TYPES)
  marketType?: typeof MARKET_TYPES[number]

  @ApiPropertyOptional()
  @ValidateIf(dto => dto.exchangeId === 'binance' || dto.exchangeId === 'okx')
  @IsString()
  apiKey?: string

  @ApiPropertyOptional()
  @ValidateIf(dto => dto.exchangeId === 'binance' || dto.exchangeId === 'okx')
  @IsString()
  apiSecret?: string

  @ApiPropertyOptional()
  @ValidateIf(dto => dto.exchangeId === 'okx')
  @IsString()
  passphrase?: string

  @ApiPropertyOptional({
    pattern: '^0x[0-9a-fA-F]{40}$',
  })
  @ValidateIf(dto => dto.exchangeId === 'hyperliquid')
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  mainWalletAddress?: string

  @ApiPropertyOptional({
    pattern: '^0x[0-9a-fA-F]{64}$',
  })
  @ValidateIf(dto => dto.exchangeId === 'hyperliquid')
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  agentPrivateKey?: string
}
