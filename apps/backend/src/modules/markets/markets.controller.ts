import type { GetLongShortRatioRequestDto } from './dto/requests/get-long-short-ratio.request.dto'
import type { GetTradingPairsRequestDto } from './dto/requests/get-trading-pairs.request.dto'
import type { LongShortRatioPointResponseDto } from './dto/responses/long-short-ratio.response.dto'
import type { TradingPairConfigResponseDto } from './dto/responses/trading-pair.response.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { convertDecimalsInObject } from '@/common/utils/decimal-converter'
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
  @ApiOkResponse({ type: TradingPairConfigResponseDto, isArray: true })
  getTradingPairs(@Query() query: GetTradingPairsRequestDto): TradingPairConfigResponseDto[] {
    const pairs = this.marketsService.findAll({
      venueType: query.venueType,
      instrumentType: query.instrumentType,
      exchange: query.exchange,
    })

    return pairs.map(pair => ({
      id: pair.id,
      displaySymbol: pair.displaySymbol,
      symbol: pair.symbol,
      baseAsset: pair.baseAsset,
      quoteAsset: pair.quoteAsset,
      venueType: pair.venueType,
      instrumentType: pair.instrumentType,
      pricePrecision: pair.pricePrecision,
      quantityPrecision: pair.quantityPrecision,
      minNotional: pair.minNotional,
      minQuantity: pair.minQuantity,
      enabled: pair.enabled,
      exchange: pair.venueType === 'CEX' ? pair.exchange : undefined,
      exchangeSymbol: pair.venueType === 'CEX' ? pair.exchangeSymbol : undefined,
      maxLeverage: pair.venueType === 'CEX' ? pair.maxLeverage : undefined,
      contractSize: pair.venueType === 'CEX' ? pair.contractSize : undefined,
      chainId: pair.venueType === 'DEX' ? pair.chainId : undefined,
      baseTokenAddress: pair.venueType === 'DEX' ? pair.baseTokenAddress : undefined,
      quoteTokenAddress: pair.venueType === 'DEX' ? pair.quoteTokenAddress : undefined,
      routerAddress: pair.venueType === 'DEX' ? pair.routerAddress : undefined,
      poolAddress: pair.venueType === 'DEX' ? pair.poolAddress : undefined,
      dexName: pair.venueType === 'DEX' ? pair.dexName : undefined,
    }))
  }

  @Get('long-short-ratio')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取交易对的多空比时间序列' })
  @ApiOkResponse({ type: LongShortRatioPointResponseDto, isArray: true })
  async getLongShortRatio(@Query() query: GetLongShortRatioRequestDto): Promise<LongShortRatioPointResponseDto[]> {
    const { tradingPairId, interval } = query

    const from = query.from ? new Date(query.from) : undefined
    const to = query.to ? new Date(query.to) : undefined
    const limit = query.limit ?? 500

    const items = await this.marketsService.getLongShortRatios({
      tradingPairId,
      interval,
      from,
      to,
      limit,
    })

    return items.map(item => {
      const {
        longShortRatio,
        longAccountRatio,
        shortAccountRatio,
        longVolume,
        shortVolume,
        longShortAccountRatio,
      } = convertDecimalsInObject(item, [
        'longShortRatio',
        'longAccountRatio',
        'shortAccountRatio',
        'longVolume',
        'shortVolume',
        'longShortAccountRatio',
      ])

      return {
        tradingPairId: item.tradingPairId,
        interval: item.interval,
        timestamp: item.timestamp.toISOString(),
        longShortRatio: longShortRatio!,
        longAccountRatio,
        shortAccountRatio,
        longVolume,
        shortVolume,
        longShortAccountRatio,
        source: item.source,
      }
    })
  }
}

