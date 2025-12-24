import type { ExchangeId, MarketInstrumentType, TradingVenueType } from '@ai/shared'
import { EXCHANGES, MARKET_INSTRUMENT_TYPES, TRADING_VENUE_TYPES } from '@ai/shared'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketsService } from './markets.service'

@ApiTags('markets')
@ApiBearerAuth('bearer')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get('pairs')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取交易对配置列表' })
  @ApiQuery({ name: 'venueType', required: false, enum: TRADING_VENUE_TYPES })
  @ApiQuery({ name: 'instrumentType', required: false, enum: MARKET_INSTRUMENT_TYPES })
  @ApiQuery({ name: 'exchange', required: false, enum: EXCHANGES })
  getTradingPairs(
    @Query('venueType') venueType?: TradingVenueType,
    @Query('instrumentType') instrumentType?: MarketInstrumentType,
    @Query('exchange') exchange?: ExchangeId,
  ) {
    return this.marketsService.findAll({
      venueType,
      instrumentType,
      exchange,
    })
  }
}

