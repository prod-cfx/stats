import type { Observable } from 'rxjs';
import type { MarketQuoteEvent } from '../services/market-data-stream.service';
import { ErrorCode, MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { Controller, Get, Inject, Query, Sse } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { fromEvent, map } from 'rxjs'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { MarketBarDto } from '../dto/market-bar.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时 DTO 元数据
import { MarketBarsQueryDto } from '../dto/market-bars-query.dto'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时 DTO 元数据
import { MarketQuoteQueryDto } from '../dto/market-quote-query.dto'
import { MarketQuoteDto } from '../dto/market-quote.response.dto'
import { MarketSymbolDto } from '../dto/market-symbol.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时 DTO 元数据
import { MarketSymbolsQueryDto } from '../dto/market-symbols-query.dto'
import { MarketDataIngestionService } from '../services/market-data-ingestion.service'
import { MARKET_QUOTE_EVENT } from '../services/market-data-stream.service'
import { MarketDataService } from '../services/market-data.service'
import { extractRawSymbol, parseSymbolMarket, toSymbolCode } from '../utils/market-symbol-code.util'

@ApiTags('market')
@ApiExtraModels(BasePaginationResponseDto, MarketSymbolDto, MarketBarDto, MarketQuoteDto)
@Controller('market')
export class MarketDataController {
  constructor(
    @Inject(MarketDataService)
    private readonly marketDataService: MarketDataService,
    @Inject(MarketDataIngestionService)
    private readonly marketDataIngestionService: MarketDataIngestionService,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('symbols')
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从 1 开始）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 50 })
  @ApiQuery({ name: 'exchange', required: false, type: String, description: '交易所筛选', example: 'BINANCE' })
  @ApiQuery({ name: 'type', required: false, enum: MARKET_SYMBOL_TYPES, description: '标的类型' })
  @ApiQuery({ name: 'status', required: false, enum: MARKET_SYMBOL_STATUSES, description: '交易对状态' })
  @ApiQuery({ name: 'instrumentType', required: false, enum: MARKET_INSTRUMENT_TYPES, description: '合约形态' })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: '交易对代码模糊搜索', example: 'BTC' })
  @ApiOperation({ summary: '查询支持的交易对列表' })
  @ApiOkResponse({
    description: '获取成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: { type: 'array', items: { $ref: getSchemaPath(MarketSymbolDto) } },
          },
        },
      ],
    },
  })
  async listSymbols(@Query() query: MarketSymbolsQueryDto) {
    return this.marketDataService.listSymbols(query)
  }

  @Get('bars')
  @ApiOperation({ summary: '查询历史 K 线' })
  @ApiOkResponse({
    description: '获取成功',
    schema: { type: 'array', items: { $ref: getSchemaPath(MarketBarDto) } },
  })
  async getBars(@Query() query: MarketBarsQueryDto) {
    return this.marketDataService.getBars(query)
  }

  @Get('quote')
  @ApiOperation({ summary: '查询最新行情快照' })
  @ApiOkResponse({ description: '获取成功', schema: { $ref: getSchemaPath(MarketQuoteDto) } })
  async getQuote(@Query() query: MarketQuoteQueryDto) {
    await this.marketDataIngestionService.ensureSymbolsSubscribed([query.symbol])

    let lastError: unknown
    for (let i = 0; i < 5; i += 1) {
      try {
        return await this.marketDataService.getLatestQuote(query)
      } catch (error) {
        lastError = error
        const code = (error as { code?: string })?.code
        if (code !== ErrorCode.MARKET_DATA_PROVIDER_ERROR && code !== ErrorCode.MARKET_SYMBOL_NOT_FOUND) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }

    // 首次补订阅时，WS 首包可能存在延迟；补一次 REST 现价兜底，提升首查体验。
    await this.tryLoadBinanceRestFallbackQuote(query.symbol)
    try {
      return await this.marketDataService.getLatestQuote(query)
    } catch {
      // ignore and throw original error below
    }

    throw lastError
  }

  private async tryLoadBinanceRestFallbackQuote(symbol: string): Promise<void> {
    const rawSymbol = extractRawSymbol(symbol)
    const market = parseSymbolMarket(symbol)
    const endpoint = market === 'PERP'
      ? 'https://fapi.binance.com/fapi/v1/ticker/24hr'
      : 'https://api.binance.com/api/v3/ticker/24hr'

    const url = `${endpoint}?symbol=${encodeURIComponent(rawSymbol)}`
    const response = await fetch(url)
    if (!response.ok) return

    const data = await response.json() as {
      c?: string
      p?: string
      P?: string
      o?: string
      h?: string
      l?: string
      v?: string
      q?: string
      b?: string
      B?: string
      a?: string
      A?: string
      E?: number
      closeTime?: number
    }

    if (!data?.c) return

    await this.marketDataService.saveQuoteFromProvider({
      symbol: toSymbolCode(rawSymbol, market),
      lastPrice: data.c,
      priceChange: data.p,
      priceChangePercent: data.P,
      openPrice: data.o,
      highPrice: data.h,
      lowPrice: data.l,
      volume: data.v,
      quoteVolume: data.q,
      bidPrice: data.b,
      bidQty: data.B,
      askPrice: data.a,
      askQty: data.A,
      eventTime: data.E ?? data.closeTime ?? Date.now(),
      source: market === 'PERP' ? 'BINANCE_REST_PERP' : 'BINANCE_REST_SPOT',
    })
  }

  @Sse('stream/ticker')
  @ApiOperation({ summary: '实时推送行情 ticker (SSE)' })
  @ApiOkResponse({ description: 'SSE 流，推送实时 ticker 数据' })
  streamTicker(): Observable<MessageEvent> {
    return fromEvent<MarketQuoteEvent>(this.eventEmitter, MARKET_QUOTE_EVENT).pipe(
      map(event => {
        const data = {
          symbol: event.data.symbol,
          lastPrice: event.data.lastPrice.toString(),
          priceChange: event.data.priceChange?.toString() ?? null,
          priceChangePercent: event.data.priceChangePercent?.toString() ?? null,
          openPrice: event.data.openPrice?.toString() ?? null,
          highPrice: event.data.highPrice?.toString() ?? null,
          lowPrice: event.data.lowPrice?.toString() ?? null,
          volume: event.data.volume?.toString() ?? null,
          quoteVolume: event.data.quoteVolume?.toString() ?? null,
          bidPrice: event.data.bidPrice?.toString() ?? null,
          bidQty: event.data.bidQty?.toString() ?? null,
          askPrice: event.data.askPrice?.toString() ?? null,
          askQty: event.data.askQty?.toString() ?? null,
          eventTime: new Date(event.data.eventTime).toISOString(),
          source: event.data.source,
        }
        return { data } as MessageEvent
      }),
    )
  }
}
