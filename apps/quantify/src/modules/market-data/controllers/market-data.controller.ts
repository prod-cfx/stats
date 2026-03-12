import type { Observable } from 'rxjs';
import type { MarketBarsQueryDto } from '../dto/market-bars-query.dto'
import type { MarketQuoteQueryDto } from '../dto/market-quote-query.dto'
import type { MarketSymbolsQueryDto } from '../dto/market-symbols-query.dto'
import type { MarketQuoteEvent } from '../services/market-data-stream.service';
import { MARKET_INSTRUMENT_TYPES, MARKET_SYMBOL_STATUSES, MARKET_SYMBOL_TYPES } from '@ai/shared'
import { Controller, Get, Inject, Query, Sse } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { fromEvent, map } from 'rxjs'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { MarketBarDto } from '../dto/market-bar.response.dto'
import { MarketQuoteDto } from '../dto/market-quote.response.dto'
import { MarketSymbolDto } from '../dto/market-symbol.response.dto'
import { MARKET_QUOTE_EVENT } from '../services/market-data-stream.service'
import { MarketDataService } from '../services/market-data.service'

@ApiTags('market')
@ApiExtraModels(BasePaginationResponseDto, MarketSymbolDto, MarketBarDto, MarketQuoteDto)
@Controller('market')
export class MarketDataController {
  constructor(
    @Inject(MarketDataService)
    private readonly marketDataService: MarketDataService,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('symbols')
  @ApiQuery({ name: 'page', required: false, type: Number, description: '椤电爜锛堜粠 1 寮€濮嬶級', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '姣忛〉鏁伴噺', example: 50 })
  @ApiQuery({ name: 'exchange', required: false, type: String, description: '浜ゆ槗鎵€绛涢€?, example: 'BINANCE' })
  @ApiQuery({ name: 'type', required: false, enum: MARKET_SYMBOL_TYPES, description: '鏍囩殑绫诲瀷' })
  @ApiQuery({ name: 'status', required: false, enum: MARKET_SYMBOL_STATUSES, description: '浜ゆ槗瀵圭姸鎬? })
  @ApiQuery({ name: 'instrumentType', required: false, enum: MARKET_INSTRUMENT_TYPES, description: '鍚堢害褰㈡€? })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: '浜ゆ槗瀵逛唬鐮佹ā绯婃悳绱?, example: 'BTC' })
  @ApiOperation({ summary: '鏌ヨ鏀寔鐨勪氦鏄撳鍒楄〃' })
  @ApiOkResponse({
    description: '鑾峰彇鎴愬姛',
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
  @ApiOperation({ summary: '鏌ヨ鍘嗗彶 K 绾? })
  @ApiOkResponse({
    description: '鑾峰彇鎴愬姛',
    schema: { type: 'array', items: { $ref: getSchemaPath(MarketBarDto) } },
  })
  async getBars(@Query() query: MarketBarsQueryDto) {
    return this.marketDataService.getBars(query)
  }

  @Get('quote')
  @ApiOperation({ summary: '鏌ヨ鏈€鏂拌鎯呭揩鐓? })
  @ApiOkResponse({ description: '鑾峰彇鎴愬姛', schema: { $ref: getSchemaPath(MarketQuoteDto) } })
  async getQuote(@Query() query: MarketQuoteQueryDto) {
    return this.marketDataService.getLatestQuote(query)
  }

  @Sse('stream/ticker')
  @ApiOperation({ summary: '瀹炴椂鎺ㄩ€佽鎯?ticker (SSE)' })
  @ApiOkResponse({ description: 'SSE 娴侊紝鎺ㄩ€佸疄鏃?ticker 鏁版嵁' })
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
