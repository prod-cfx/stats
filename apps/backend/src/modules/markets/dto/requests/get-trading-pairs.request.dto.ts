import type { MarketInstrumentType, TradingExchangeId, TradingVenueType } from '@ai/shared'
import { EXCHANGES, MARKET_INSTRUMENT_TYPES, TRADING_VENUE_TYPES } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'

export class GetTradingPairsRequestDto {
  @ApiPropertyOptional({ description: '交易 venue 类型', enum: TRADING_VENUE_TYPES })
  @IsOptional()
  @IsEnum(TRADING_VENUE_TYPES, { message: 'venueType 必须是有效的交易场所类型' })
  venueType?: TradingVenueType

  @ApiPropertyOptional({ description: '交易品种类型', enum: MARKET_INSTRUMENT_TYPES })
  @IsOptional()
  @IsEnum(MARKET_INSTRUMENT_TYPES, { message: 'instrumentType 必须是有效的交易品种类型' })
  instrumentType?: MarketInstrumentType

  @ApiPropertyOptional({ description: '交易所标识，仅对 CEX 生效', enum: EXCHANGES })
  @IsOptional()
  @IsEnum(EXCHANGES, { message: 'exchange 必须是受支持的交易所' })
  exchange?: TradingExchangeId
}

