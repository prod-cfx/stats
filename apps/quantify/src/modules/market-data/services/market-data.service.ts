import type { MarketBarPayload, MarketQuotePayload, MarketTimeframe } from '@ai/shared'
import type { InstrumentType, Prisma, Symbol as PrismaSymbol, SymbolType } from '@prisma/client'
import type { MarketBarsQueryDto } from '../dto/market-bars-query.dto'
import type { MarketQuoteQueryDto } from '../dto/market-quote-query.dto'
import type { MarketSymbolsQueryDto } from '../dto/market-symbols-query.dto'
import type { CreateMarketSymbolDto, UpdateMarketSymbolDto } from '../dto/ops-market-symbol.dto'
import type { ProviderSymbol } from '../interfaces/market-data-provider.interface'
import { ErrorCode } from '@ai/shared'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { SymbolStatus as PrismaSymbolStatus } from '@prisma/client'
import { DomainException } from '@/common/exceptions/domain.exception'
import { 
  mapSymbolStatus, 
  mapTimeframe,
  reverseMapTimeframe 
} from '@/common/utils/prisma-enum-mappers'
import { IndicatorEngineService } from '@/modules/indicators/services/indicator-engine.service'
import { PrismaService } from '@/prisma/prisma.service'
import { MarketSymbolNotFoundException } from '../exceptions'

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name)
  private readonly symbolIdCache = new Map<string, string>()

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(IndicatorEngineService)
    private readonly indicatorEngine: IndicatorEngineService,
  ) {}

  async listSymbols(query: MarketSymbolsQueryDto) {
    const where: Prisma.SymbolWhereInput = {}
    if (query.exchange) where.exchange = query.exchange.toUpperCase()
    if (query.status) where.status = mapSymbolStatus(query.status)
    if (query.instrumentType) where.instrumentType = query.instrumentType as InstrumentType
    if (query.type) where.type = query.type as SymbolType
    if (query.keyword) {
      where.code = {
        contains: query.keyword.toUpperCase(),
      }
    }

    // 确保分页参数有效值
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit
    
    const [items, total] = await Promise.all([
      this.prisma.symbol.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.symbol.count({ where }),
    ])

    return {
      items: items.map(symbol => this.toMarketSymbolResponse(symbol)),
      total,
      page,
      limit,
    }
  }

  async createSymbol(payload: CreateMarketSymbolDto) {
    const code = this.normalizeSymbol(payload.code)
    const baseAsset = payload.baseAsset.trim().toUpperCase()
    const quoteAsset = payload.quoteAsset.trim().toUpperCase()
    const exchange = payload.exchange.trim().toUpperCase()

    // 处理空字符串，转为 null（Prisma Decimal 不接受空字符串）
    const normalizeDecimal = (value: string | null | undefined): string | null | undefined => {
      if (typeof value === 'string' && value.trim() === '') {
        return null
      }
      return value ?? undefined
    }

    const symbol = await this.prisma.symbol.create({
      data: {
        code,
        baseAsset,
        quoteAsset,
        exchange,
        type: payload.type as SymbolType,
        instrumentType: payload.instrumentType as InstrumentType,
        status: mapSymbolStatus(payload.status),
        precisionPrice: payload.precisionPrice,
        precisionQuantity: payload.precisionQuantity,
        tickSize: normalizeDecimal(payload.tickSize),
        lotSize: normalizeDecimal(payload.lotSize),
        isMarginEnabled: payload.isMarginEnabled,
      },
    })

    this.symbolIdCache.set(symbol.code, symbol.id)

    return this.toMarketSymbolResponse(symbol)
  }

  async updateSymbol(codeOrSymbol: string, payload: UpdateMarketSymbolDto) {
    const code = this.normalizeSymbol(codeOrSymbol)

    const existing = await this.prisma.symbol.findUnique({
      where: { code },
    })

    if (!existing) {
      throw new MarketSymbolNotFoundException({ symbol: codeOrSymbol })
    }

    const data: Prisma.SymbolUpdateInput = {}

    if (payload.baseAsset !== undefined) {
      data.baseAsset = payload.baseAsset.trim().toUpperCase()
    }
    if (payload.quoteAsset !== undefined) {
      data.quoteAsset = payload.quoteAsset.trim().toUpperCase()
    }
    if (payload.exchange !== undefined) {
      data.exchange = payload.exchange.trim().toUpperCase()
    }
    if (payload.type !== undefined) {
      data.type = payload.type as SymbolType
    }
    if (payload.instrumentType !== undefined) {
      data.instrumentType = payload.instrumentType as InstrumentType
    }
    if (payload.status !== undefined) {
      data.status = mapSymbolStatus(payload.status)
    }
    if (payload.precisionPrice !== undefined) {
      data.precisionPrice = payload.precisionPrice
    }
    if (payload.precisionQuantity !== undefined) {
      data.precisionQuantity = payload.precisionQuantity
    }
    if (payload.tickSize !== undefined) {
      // 显式支持 null 和空字符串，允许清空字段
      if (payload.tickSize === null || (typeof payload.tickSize === 'string' && payload.tickSize.trim() === '')) {
        data.tickSize = null
      } else {
        data.tickSize = payload.tickSize ?? undefined
      }
    }
    if (payload.lotSize !== undefined) {
      // 显式支持 null 和空字符串，允许清空字段
      if (payload.lotSize === null || (typeof payload.lotSize === 'string' && payload.lotSize.trim() === '')) {
        data.lotSize = null
      } else {
        data.lotSize = payload.lotSize ?? undefined
      }
    }
    if (payload.isMarginEnabled !== undefined) {
      data.isMarginEnabled = payload.isMarginEnabled
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('至少需要提供一个字段进行更新')
    }

    const symbol = await this.prisma.symbol.update({
      where: { code },
      data,
    })

    this.symbolIdCache.set(symbol.code, symbol.id)

    return this.toMarketSymbolResponse(symbol)
  }

  async getBars(query: MarketBarsQueryDto) {
    const symbol = await this.getSymbolOrThrow(query.symbol)
    const timeframe = mapTimeframe(query.timeframe as MarketTimeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)
    const where: Prisma.MarketBarWhereInput = {
      symbolId: symbol.id,
      timeframe,
    }
    if (query.start || query.end) {
      where.time = {}
      if (query.start) where.time!.gte = new Date(query.start)
      if (query.end) where.time!.lte = new Date(query.end)
    }

    // 如果没有指定时间范围，默认返回最新的 K 线（降序取 limit 条后反转）
    // 如果指定了时间范围，则按时间升序返回
    const hasTimeFilter = Boolean(query.start || query.end)
    const orderBy = hasTimeFilter ? { time: 'asc' as const } : { time: 'desc' as const }

    const bars = await this.prisma.marketBar.findMany({
      where,
      orderBy,
      take: query.limit,
    })

    // 如果是降序查询（默认最新数据），需要反转结果以保持时间升序
    const orderedBars = hasTimeFilter ? bars : bars.reverse()

    return orderedBars.map(bar => ({
      time: bar.time.toISOString(),
      timeframe: reverseMapTimeframe(bar.timeframe),
      open: bar.open.toString(),
      high: bar.high.toString(),
      low: bar.low.toString(),
      close: bar.close.toString(),
      volume: bar.volume?.toString() ?? null,
      quoteVolume: bar.quoteVolume?.toString() ?? null,
      trades: bar.trades ?? null,
      isFinal: bar.isFinal,
    }))
  }

  async getLatestQuote(query: MarketQuoteQueryDto) {
    const symbol = await this.getSymbolOrThrow(query.symbol)
    const latest = await this.prisma.marketQuote.findFirst({
      where: { symbolId: symbol.id },
      orderBy: { eventTime: 'desc' },
    })
    if (!latest) {
      throw new DomainException('No market data available', {
        code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
        args: { symbol: query.symbol },
      })
    }

    return {
      symbol: symbol.code,
      lastPrice: latest.lastPrice.toString(),
      priceChange: latest.priceChange?.toString() ?? null,
      priceChangePercent: latest.priceChangePercent?.toString() ?? null,
      openPrice: latest.openPrice?.toString() ?? null,
      highPrice: latest.highPrice?.toString() ?? null,
      lowPrice: latest.lowPrice?.toString() ?? null,
      volume: latest.volume?.toString() ?? null,
      quoteVolume: latest.quoteVolume?.toString() ?? null,
      bidPrice: latest.bidPrice?.toString() ?? null,
      bidQty: latest.bidQty?.toString() ?? null,
      askPrice: latest.askPrice?.toString() ?? null,
      askQty: latest.askQty?.toString() ?? null,
      eventTime: latest.eventTime.toISOString(),
      source: latest.source,
    }
  }

  async upsertSymbolsFromProvider(symbols: ProviderSymbol[], exchangeFallback: string) {
    for (const symbol of symbols) {
      const exchange = symbol.exchange?.toUpperCase() ?? exchangeFallback
      const code = this.normalizeSymbol(symbol.symbol)
      await this.prisma.symbol.upsert({
        where: { code },
        create: {
          code,
          baseAsset: symbol.baseAsset.toUpperCase(),
          quoteAsset: symbol.quoteAsset.toUpperCase(),
          exchange,
          type: (symbol.type ?? 'CRYPTO') as SymbolType,
          instrumentType: (symbol.instrumentType ?? 'SPOT') as InstrumentType,
          status: this.mapProviderStatus(symbol.status),
          precisionPrice: this.estimatePrecision(symbol.filters, 'tickSize', 2),
          precisionQuantity: this.estimatePrecision(symbol.filters, 'stepSize', 6),
          tickSize: this.extractFilterValue(symbol.filters, 'tickSize'),
          lotSize: this.extractFilterValue(symbol.filters, 'stepSize'),
          isMarginEnabled: Boolean(symbol.isMarginTradingAllowed),
        },
        update: {
          baseAsset: symbol.baseAsset.toUpperCase(),
          quoteAsset: symbol.quoteAsset.toUpperCase(),
          exchange,
          status: this.mapProviderStatus(symbol.status),
          instrumentType: (symbol.instrumentType ?? 'SPOT') as InstrumentType,
          precisionPrice: this.estimatePrecision(symbol.filters, 'tickSize', 2),
          precisionQuantity: this.estimatePrecision(symbol.filters, 'stepSize', 6),
          tickSize: this.extractFilterValue(symbol.filters, 'tickSize'),
          lotSize: this.extractFilterValue(symbol.filters, 'stepSize'),
          isMarginEnabled: Boolean(symbol.isMarginTradingAllowed),
        },
      })
    }
  }

  async saveBarFromProvider(payload: MarketBarPayload) {
    const symbol = await this.getSymbolOrThrow(payload.symbol)
    const prismaTimeframe = mapTimeframe(payload.timeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)
    
    await this.prisma.marketBar.upsert({
      where: {
        symbolId_timeframe_time: {
          symbolId: symbol.id,
          timeframe: prismaTimeframe,
          time: new Date(payload.timestamp),
        },
      },
      create: {
        symbolId: symbol.id,
        timeframe: prismaTimeframe,
        time: new Date(payload.timestamp),
        open: payload.open,
        high: payload.high,
        low: payload.low,
        close: payload.close,
        volume: payload.volume,
        quoteVolume: payload.quoteVolume,
        trades: payload.trades,
        source: payload.source,
        isFinal: payload.isFinal ?? true,
      },
      update: {
        open: payload.open,
        high: payload.high,
        low: payload.low,
        close: payload.close,
        volume: payload.volume,
        quoteVolume: payload.quoteVolume,
        trades: payload.trades,
        source: payload.source,
        isFinal: payload.isFinal ?? true,
      },
    })

    // 保存 K 线后触发指标计算（若存在相关配置）
    await this.indicatorEngine.handleNewBar({
      symbolId: symbol.id,
      symbolCode: symbol.code,
      timeframe: payload.timeframe,
    })
  }

  async saveQuoteFromProvider(payload: MarketQuotePayload) {
    const symbol = await this.getSymbolOrThrow(payload.symbol)
    await this.prisma.marketQuote.create({
      data: {
        symbolId: symbol.id,
        lastPrice: payload.lastPrice,
        priceChange: payload.priceChange,
        priceChangePercent: payload.priceChangePercent,
        openPrice: payload.openPrice,
        highPrice: payload.highPrice,
        lowPrice: payload.lowPrice,
        volume: payload.volume,
        quoteVolume: payload.quoteVolume,
        bidPrice: payload.bidPrice,
        bidQty: payload.bidQty,
        askPrice: payload.askPrice,
        askQty: payload.askQty,
        eventTime: new Date(payload.eventTime),
        source: payload.source,
      },
    })
  }

  async getSymbolOrThrow(symbolCode: string) {
    const normalized = this.normalizeSymbol(symbolCode)
    const cached = this.symbolIdCache.get(normalized)
    if (cached) {
      return { id: cached, code: normalized }
    }
    const symbol = await this.prisma.symbol.findUnique({
      where: { code: normalized },
      select: { id: true, code: true },
    })
    if (!symbol) {
      throw new MarketSymbolNotFoundException({ symbol: symbolCode })
    }
    this.symbolIdCache.set(normalized, symbol.id)
    return symbol
  }

  private toMarketSymbolResponse(symbol: PrismaSymbol) {
    return {
      code: symbol.code,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      exchange: symbol.exchange,
      type: symbol.type,
      instrumentType: symbol.instrumentType,
      status: symbol.status,
      precisionPrice: symbol.precisionPrice,
      precisionQuantity: symbol.precisionQuantity,
      tickSize: symbol.tickSize?.toString() ?? null,
      lotSize: symbol.lotSize?.toString() ?? null,
      isMarginEnabled: symbol.isMarginEnabled,
      updatedAt: symbol.updatedAt.toISOString(),
    }
  }

  private normalizeSymbol(symbol?: string): string {
    return (symbol ?? '').trim().toUpperCase()
  }

  private mapProviderStatus(rawStatus?: string): PrismaSymbolStatus {
    const normalized = (rawStatus ?? '').trim().toUpperCase()

    if (!normalized || normalized === 'ACTIVE') {
      return PrismaSymbolStatus.ACTIVE
    }

    // 交易所常见状态到内部状态的映射
    switch (normalized) {
      case 'TRADING':
      case 'OPEN':
      case 'ONLINE':
        return PrismaSymbolStatus.ACTIVE

      case 'HALT':
      case 'HALTED':
      case 'SUSPEND':
      case 'SUSPENDED':
      case 'BREAK':
      case 'CLOSE':
      case 'OFFLINE':
      case 'DELISTED':
        return PrismaSymbolStatus.DISABLED

      default:
        this.logger.warn(`未知交易对状态 "${rawStatus}"，按 DISABLED 处理`)
        return PrismaSymbolStatus.DISABLED
    }
  }

  private extractFilterValue(
    filters: ProviderSymbol['filters'],
    key: 'tickSize' | 'stepSize',
  ): string | undefined {
    if (!filters) return undefined
    for (const filter of filters) {
      if (key === 'tickSize' && filter.tickSize) return filter.tickSize
      if (key === 'stepSize' && filter.stepSize) return filter.stepSize
    }
    return undefined
  }

  private estimatePrecision(
    filters: ProviderSymbol['filters'],
    key: 'tickSize' | 'stepSize',
    fallback: number,
  ): number {
    const value = this.extractFilterValue(filters, key)
    if (!value) return fallback
    const decimalIndex = value.indexOf('.')
    if (decimalIndex === -1) return fallback
    const trimmed = value.slice(decimalIndex + 1)
    const precision = trimmed.replace(/0+$/, '').length
    return precision > 0 ? precision : fallback
  }
}
