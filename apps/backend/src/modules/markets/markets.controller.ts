/* eslint-disable perfectionist/sort-imports -- NestJS 控制器按语义分组导入 DTO 与 Service，避免自动排序影响可读性与元数据推断 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { GetExchangeLongShortRatioRequestDto } from './dto/requests/get-exchange-long-short-ratio.request.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetLongShortRatioRequestDto } from './dto/requests/get-long-short-ratio.request.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetTradingPairsRequestDto } from './dto/requests/get-trading-pairs.request.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  GetLargeTradesRequestDto,
  GetLatestTradesRequestDto,
  GetMarketTradesRequestDto,
} from './dto/requests/get-market-trades.request.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetAggregatedVolumeRequestDto } from './dto/requests/get-aggregated-volume.request.dto'
import type { GetTickerRequestDto } from './dto/requests/get-ticker.request.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { BaseResponseDto } from '@/common/dto/base.dto'
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { convertDecimalsInObject } from '@/common/utils/decimal-converter'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { OptionalAccessControl, ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { ExchangeLongShortRatioResponseDto } from './dto/responses/exchange-long-short-ratio.response.dto'
import { LongShortRatioPointResponseDto } from './dto/responses/long-short-ratio.response.dto'
import { TradingPairConfigResponseDto } from './dto/responses/trading-pair.response.dto'
import { MarketTradeResponseDto } from './dto/responses/market-trade.response.dto'
import { AggregatedVolumeResponseDto } from './dto/responses/aggregated-volume.response.dto'
import { TickerResponseDto } from './dto/responses/ticker.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketsService } from './markets.service'

/* eslint-enable perfectionist/sort-imports */

const baseArrayResponseSchema = (itemDto: unknown) => ({
  allOf: [
    { $ref: getSchemaPath(BaseResponseDto) },
    {
      properties: {
        data: {
          type: 'array',
          items: {
            $ref: getSchemaPath(itemDto as any),
          },
        },
      },
    },
  ],
})

@ApiTags('markets')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  BaseResponseDto,
  ExchangeLongShortRatioResponseDto,
  BasePaginationResponseDto,
  MarketTradeResponseDto,
  AggregatedVolumeResponseDto,
  TickerResponseDto,
)
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get('pairs')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiQuery({
    name: 'venueType',
    required: false,
    description: '交易 venue 类型',
  })
  @ApiQuery({
    name: 'instrumentType',
    required: false,
    description: '交易品种类型',
  })
  @ApiQuery({
    name: 'exchange',
    required: false,
    description: '交易所标识，仅对 CEX 生效',
  })
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
  @OptionalAccessControl()
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
        interval: reverseMapTimeframe(item.interval as any),
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

  @Get('long-short-ratio/exchanges')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '按交易所维度获取指定标的的多空比快照' })
  @ApiOkResponse({
    schema: baseArrayResponseSchema(ExchangeLongShortRatioResponseDto),
  })
  async getExchangeLongShortRatio(
    @Query() query: GetExchangeLongShortRatioRequestDto,
  ): Promise<ExchangeLongShortRatioResponseDto[]> {
    const { symbol, timeRange } = query

    return this.marketsService.getExchangeLongShortRatios({
      symbol,
      timeRange,
    })
  }

  @Get('trades/latest')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取最新成交记录' })
  @ApiOkResponse({ type: MarketTradeResponseDto, isArray: true })
  async getLatestTrades(@Query() query: GetLatestTradesRequestDto): Promise<MarketTradeResponseDto[]> {
    const { exchange, instrumentType, symbol, limit = 50 } = query

    const trades = await this.marketsService.getLatestTrades(exchange, instrumentType, symbol, limit)

    return trades.map(trade => ({
      id: trade.id,
      exchange: trade.exchange,
      instrumentType: trade.instrumentType,
      symbol: trade.symbol,
      baseAsset: trade.baseAsset,
      quoteAsset: trade.quoteAsset,
      tradeId: trade.tradeId,
      price: trade.price.toString(),
      size: trade.size.toString(),
      side: trade.side,
      tradeTimestamp: trade.tradeTimestamp.toString(),
      createdAt: trade.createdAt.toISOString(),
    }))
  }

  @Get('trades/large')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取大额成交记录' })
  @ApiOkResponse({ type: MarketTradeResponseDto, isArray: true })
  async getLargeTrades(@Query() query: GetLargeTradesRequestDto): Promise<MarketTradeResponseDto[]> {
    const { exchange, instrumentType, symbol, minValue = 100000, limit = 50 } = query

    const trades = await this.marketsService.getLargeTrades(exchange, instrumentType, symbol, minValue, limit)

    return trades.map(trade => ({
      id: trade.id,
      exchange: trade.exchange,
      instrumentType: trade.instrumentType,
      symbol: trade.symbol,
      baseAsset: trade.baseAsset,
      quoteAsset: trade.quoteAsset,
      tradeId: trade.tradeId,
      price: trade.price.toString(),
      size: trade.size.toString(),
      side: trade.side,
      tradeTimestamp: trade.tradeTimestamp.toString(),
      createdAt: trade.createdAt.toISOString(),
    }))
  }

  @Get('trades')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '查询交易记录（分页）' })
  @ApiOkResponse({
    description: '查询成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(MarketTradeResponseDto) },
            },
          },
        },
      ],
    },
  })
  async getTrades(
    @Query() query: GetMarketTradesRequestDto,
  ): Promise<BasePaginationResponseDto<MarketTradeResponseDto>> {
    const pageResult = await this.marketsService.getTrades(query)

    const items: MarketTradeResponseDto[] = pageResult.items.map(trade => ({
      id: trade.id,
      exchange: trade.exchange,
      instrumentType: trade.instrumentType,
      symbol: trade.symbol,
      baseAsset: trade.baseAsset,
      quoteAsset: trade.quoteAsset,
      tradeId: trade.tradeId,
      price: trade.price.toString(),
      size: trade.size.toString(),
      side: trade.side,
      tradeTimestamp: trade.tradeTimestamp.toString(),
      createdAt: trade.createdAt.toISOString(),
    }))

    return new BasePaginationResponseDto(pageResult.total, pageResult.page, pageResult.limit, items)
  }

  @Get('volume/aggregated')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '查询聚合交易量（分页）' })
  @ApiOkResponse({
    description: '查询成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AggregatedVolumeResponseDto) },
            },
          },
        },
      ],
    },
  })
  async getAggregatedVolumes(
    @Query() query: GetAggregatedVolumeRequestDto,
  ): Promise<BasePaginationResponseDto<AggregatedVolumeResponseDto>> {
    return this.marketsService.getAggregatedVolumes(query)
  }

  @Get('ticker')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取币种市场行情数据（Ticker）' })
  @ApiOkResponse({ type: TickerResponseDto })
  async getTicker(@Query() query: GetTickerRequestDto): Promise<TickerResponseDto | null> {
    const { symbol, exchange } = query

    const ticker = await this.marketsService.getTicker(symbol, exchange)

    if (!ticker) {
      return null
    }

    return {
      symbol: ticker.symbol,
      exchange: ticker.exchange,
      currentPrice: ticker.currentPrice.toString(),
      indexPrice: ticker.indexPrice?.toString(),
      priceChangePercent24h: ticker.priceChangePercent24h?.toString(),
      volumeUsd: ticker.volumeUsd.toString(),
      openInterestUsd: ticker.openInterestUsd?.toString(),
      fundingRate: ticker.fundingRate?.toString(),
      nextFundingTime: ticker.nextFundingTime?.toString(),
    }
  }
}
