/**
 * LLM Orchestrated Engine v3 - Function Calling Tools Executor
 *
 * 瀹炵幇鎵€鏈?v3 寮曟搸宸ュ叿鐨勬墽琛岄€昏緫
 */

import type { MarketBarPayload, MarketTimeframe } from '@ai/shared'
import type { OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common'
import type {
  ComputeFinancialMetricsParams,
  ComputeFinancialMetricsResult,
  ComputeTechnicalIndicatorsParams,
  ComputeTechnicalIndicatorsResult,
  GetMarketDataRawParams,
  GetMarketDataRawResult,
  GetSymbolUniverseParams,
  GetSymbolUniverseResult,
  LlmV3ToolName,
} from './llm-v3-tools.schemas'
import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import {
  annualizedReturn,
  annualizedVolatility,
  maxDrawdown,
  sharpeRatio,
  winRate,
} from '@ai/shared/script-engine/helpers/finance-helpers'
import {
  atr,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
} from '@ai/shared/script-engine/helpers/technical-indicators'
import { Injectable, Logger } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 PrismaService
import { PrismaService } from '@/prisma/prisma.service'

/**
 * 宸ュ叿鎵ц涓婁笅鏂囷紙鐢ㄤ簬瀛樺偍涓棿鏁版嵁锛?
 */
interface ToolExecutionContext {
  /** 绛栫暐瀹炰緥 ID锛堢敤浜庢潈闄愭牎楠岋級 */
  strategyInstanceId: string
  /** 浼氳瘽 ID锛堢敤浜庤法宸ュ叿璋冪敤鍏变韩缂撳瓨锛?*/
  sessionId?: string
  /** 鍏佽鐨?symbols锛堜粠绛栫暐閰嶇疆涓幏鍙栵級 */
  allowedSymbols?: string[]
  /** 鍏佽鐨?timeframes锛堜粠绛栫暐閰嶇疆涓幏鍙栵級 */
  allowedTimeframes?: string[]
  /** 鏁版嵁涓婁笅鏂囩紦瀛橈紙contextId -> cached data with metadata锛?*/
  dataContextCache: Map<string, CachedMarketData>
}

/**
 * 缂撳瓨鐨勫競鍦烘暟鎹紙鍖呭惈鍏冩暟鎹敤浜庢潈闄愭牎楠岋級
 */
interface CachedMarketData {
  /** 鏍囩殑浠ｇ爜 */
  symbol: string
  /** 鏃堕棿鍛ㄦ湡 */
  timeframe: string
  /** K 绾挎暟鎹?*/
  bars: MarketBarPayload[]
  /** 缂撳瓨鏃堕棿鎴筹紙鐢ㄤ簬 TTL锛?*/
  cachedAt: number
}

/**
 * 浼氳瘽缂撳瓨鍏冩暟鎹?
 */
interface SessionCacheMetadata {
  /** 绛栫暐瀹炰緥 ID锛堢敤浜庨殧绂讳笉鍚岀瓥鐣ョ殑缂撳瓨锛?*/
  strategyInstanceId: string
  /** 鏁版嵁涓婁笅鏂囩紦瀛?*/
  dataCache: Map<string, CachedMarketData>
  /** 鍒涘缓鏃堕棿 */
  createdAt: number
  /** 鏈€鍚庤闂椂闂?*/
  lastAccessedAt: number
}

@Injectable()
export class LlmV3ToolsExecutor implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(LlmV3ToolsExecutor.name)

  /**
   * 浼氳瘽绾ф暟鎹紦瀛橈紙璺ㄥ伐鍏疯皟鐢ㄥ叡浜級
   * Key: `${strategyInstanceId}:${sessionId}`, Value: SessionCacheMetadata
   */
  private readonly sessionCaches = new Map<string, SessionCacheMetadata>()

  /**
   * 缂撳瓨 TTL锛堟绉掞級- 榛樿 1 灏忔椂
   */
  private readonly CACHE_TTL_MS = 60 * 60 * 1000

  /**
   * 缂撳瓨娓呯悊闂撮殧锛堟绉掞級- 榛樿 5 鍒嗛挓
   */
  private readonly CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

  /**
   * 鏈€澶х紦瀛樻潯鐩暟閲?- 闃叉鏃犻檺澧為暱
   */
  private readonly MAX_CACHE_ENTRIES = 1000

  /**
   * 瀹氭椂娓呯悊浠诲姟鍙ユ焺
   */
  private cacheCleanupInterval?: NodeJS.Timeout

  constructor(private readonly prisma: PrismaService) {
    // 鍚姩瀹氭椂娓呯悊浠诲姟
    this.startCacheCleanupTimer()
  }

  /**
   * 鍚姩缂撳瓨鑷姩娓呯悊瀹氭椂鍣?
   */
  private startCacheCleanupTimer(): void {
    if (this.cacheCleanupInterval) {
      return
    }

    const interval = setInterval(() => {
      this.cleanupExpiredCaches()
    }, this.CACHE_CLEANUP_INTERVAL_MS)

    // 閬垮厤闃诲娴嬭瘯/鑴氭湰杩涚▼閫€鍑?
    interval.unref?.()

    this.cacheCleanupInterval = interval
  }

  /**
   * 鍋滄缂撳瓨娓呯悊瀹氭椂鍣?
   */
  private stopCacheCleanupTimer(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
      this.cacheCleanupInterval = undefined
    }
  }

  /**
   * 娓呯悊杩囨湡鐨勭紦瀛?
   */
  private cleanupExpiredCaches(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, metadata] of this.sessionCaches.entries()) {
      // 娓呯悊瓒呰繃 TTL 鐨勭紦瀛?
      if (now - metadata.lastAccessedAt > this.CACHE_TTL_MS) {
        this.sessionCaches.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired session cache(s)`)
    }
  }

  onModuleDestroy(): void {
    this.stopCacheCleanupTimer()
  }

  onApplicationShutdown(): void {
    this.stopCacheCleanupTimer()
  }

  /**
   * 鎵ц宸ュ叿璋冪敤锛堜富鍏ュ彛锛?
   * @param toolName 宸ュ叿鍚嶇О
   * @param params 宸ュ叿鍙傛暟
   * @param strategyInstanceId 绛栫暐瀹炰緥ID锛堢敤浜庡姞杞界櫧鍚嶅崟閰嶇疆锛?
   * @param sessionId 浼氳瘽ID锛堢敤浜庤法宸ュ叿璋冪敤鍏变韩缂撳瓨锛屽彲閫夛級
   * @returns 宸ュ叿鎵ц缁撴灉
   */
  async executeTool(
    toolName: LlmV3ToolName,
    params: any,
    strategyInstanceId: string,
    sessionId?: string,
  ): Promise<any> {
    this.logger.debug(`Executing tool: ${toolName} for strategy instance: ${strategyInstanceId}, session: ${sessionId || 'none'}`)

    const contextId = params && typeof params === 'object' ? (params as { contextId?: string }).contextId : undefined
    if (contextId && !sessionId) {
      throw new DomainException(
        `contextId "${contextId}" requires a stable sessionId to persist data across tool calls`,
        {
          code: ErrorCode.BAD_REQUEST,
          args: { contextId },
        },
      )
    }

    // 鏈嶅姟绔己鍒跺姞杞?context锛屼笉淇′换璋冪敤鏂逛紶鍏ョ殑閰嶇疆
    // 濡傛灉鎻愪緵浜?sessionId锛屽垯浣跨敤鍏变韩鐨勭紦瀛?
    const context = await this.createContext(strategyInstanceId, sessionId)

    switch (toolName) {
      case 'get_symbol_universe':
        return this.getSymbolUniverse(params, context)
      case 'get_market_data_raw':
        return this.getMarketDataRaw(params, context)
      case 'compute_technical_indicators':
        return this.computeTechnicalIndicators(params, context)
      case 'compute_financial_metrics':
        return this.computeFinancialMetrics(params, context)
      default:
        throw new DomainException(`Unknown tool: ${toolName}`, {
          code: ErrorCode.BAD_REQUEST,
        })
    }
  }

  /**
   * 娓呯悊浼氳瘽缂撳瓨锛堝湪绛栫暐鎵ц瀹屾垚鍚庤皟鐢級
   * @param strategyInstanceId 绛栫暐瀹炰緥ID
   * @param sessionId 浼氳瘽ID
   */
  clearSessionCache(strategyInstanceId: string, sessionId: string): void {
    const cacheKey = `${strategyInstanceId}:${sessionId}`
    this.sessionCaches.delete(cacheKey)
    this.logger.debug(`Cleared session cache for key: ${cacheKey}`)
  }

  /**
   * 灏嗚緭鍏ヨ鑼冨寲涓哄瓧绗︿覆鏁扮粍锛屽苟瀵归潪娉曢厤缃粰鍑烘槑纭敊璇?
   */
  private normalizeStringArray(
    raw: unknown,
    options: { fieldName: string; strategyInstanceId: string; uppercase?: boolean },
  ): string[] | undefined {
    const { fieldName, strategyInstanceId, uppercase = false } = options

    if (raw == null) {
      return undefined
    }

    const values: unknown[] =
      typeof raw === 'string'
        ? [raw]
        : Array.isArray(raw)
          ? raw
          : (() => {
              throw new DomainException(
                `Invalid ${fieldName} configuration for strategy ${strategyInstanceId}. Expected string or string array.`,
                {
                  code: ErrorCode.BAD_REQUEST,
                  args: { fieldName, strategyInstanceId },
                },
              )
            })()

    const normalized = values.map((value, index) => {
      if (typeof value !== 'string') {
        throw new DomainException(
          `Invalid ${fieldName} entry at index ${index} for strategy ${strategyInstanceId}. Expected string.`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { fieldName, strategyInstanceId, index },
          },
        )
      }

      const trimmed = value.trim()
      if (!trimmed) {
        throw new DomainException(
          `Invalid ${fieldName} entry at index ${index} for strategy ${strategyInstanceId}. Value cannot be empty.`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { fieldName, strategyInstanceId, index },
          },
        )
      }

      return uppercase ? trimmed.toUpperCase() : trimmed
    })

    const unique = Array.from(new Set(normalized))
    return unique.length > 0 ? unique : undefined
  }

  /**
   * 灏嗚緭鍏ヨ鑼冨寲涓烘暟瀛楁暟缁勶紝骞跺闈炴硶鍊兼姏鍑?DomainException
   */
  private normalizeNumberArray(
    raw: unknown,
    fieldName: string,
    options: { minItems?: number } = {},
  ): number[] | undefined {
    if (raw == null) {
      return undefined
    }

    if (!Array.isArray(raw)) {
      throw new DomainException(
        `Invalid ${fieldName}: expected an array`,
        {
          code: ErrorCode.BAD_REQUEST,
          args: { fieldName },
        },
      )
    }

    const normalized = raw.map((value, index) => {
      let num: number
      if (typeof value === 'number') {
        num = value
      }
      else if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) {
          throw new DomainException(
            `Invalid ${fieldName} entry at index ${index}: empty string`,
            {
              code: ErrorCode.BAD_REQUEST,
              args: { fieldName, index },
            },
          )
        }
        num = Number(trimmed)
      }
      else {
        throw new DomainException(
          `Invalid ${fieldName} entry at index ${index}: expected number or numeric string`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { fieldName, index },
          },
        )
      }

      if (!Number.isFinite(num)) {
        throw new DomainException(
          `Invalid ${fieldName} entry at index ${index}: ${value} is not finite`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { fieldName, index },
          },
        )
      }

      return num
    })

    if (options.minItems && normalized.length < options.minItems) {
      throw new DomainException(
        `Invalid ${fieldName}: expected at least ${options.minItems} values`,
        {
          code: ErrorCode.BAD_REQUEST,
          args: { fieldName, minItems: options.minItems },
        },
      )
    }

    return normalized
  }

  /**
   * 鏍规嵁鏉冪泭鏇茬嚎鎺ㄥ鏀剁泭鐜囧簭鍒?
   */
  private deriveReturnsFromEquityCurve(equityCurve: number[]): number[] {
    const returns: number[] = []
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1]!
      const curr = equityCurve[i]!
      if (prev > 0) {
        returns.push((curr - prev) / prev)
      }
    }
    return returns
  }

  /**
   * 宸ュ叿 1: 鑾峰彇绛栫暐鍏佽鐨勪氦鏄撴爣鐨勫拰鏃堕棿妗嗘灦
   */
  async getSymbolUniverse(
    params: GetSymbolUniverseParams,
    context: ToolExecutionContext,
  ): Promise<GetSymbolUniverseResult> {
    const client = this.prisma.getClient()

    // 鏋勫缓鏌ヨ鏉′欢
    const where: Prisma.SymbolWhereInput = {
      status: 'ACTIVE',
    }

    const filter = params.filter

    // 杩愯鏃舵牎楠岋細exchange/baseAsset 蹇呴』鏄潪绌哄瓧绗︿覆
    if (filter?.exchange != null) {
      if (typeof filter.exchange !== 'string' || filter.exchange.trim().length === 0) {
        throw new DomainException('filter.exchange must be a non-empty string', {
          code: ErrorCode.BAD_REQUEST,
        })
      }
      where.exchange = filter.exchange.trim().toUpperCase()
    }

    if (filter?.baseAsset != null) {
      if (typeof filter.baseAsset !== 'string' || filter.baseAsset.trim().length === 0) {
        throw new DomainException('filter.baseAsset must be a non-empty string', {
          code: ErrorCode.BAD_REQUEST,
        })
      }
      where.baseAsset = filter.baseAsset.trim().toUpperCase()
    }

    // 杩愯鏃舵牎楠岋細type 浠呭厑璁稿悎娉曟灇涓惧€硷紙涓庣幇鏈?Symbol.type 鍖归厤锛?
    if (filter?.type != null) {
      const allowedTypes = ['CRYPTO', 'STOCK', 'FOREX']
      if (!allowedTypes.includes(filter.type)) {
        throw new DomainException(
          `Invalid filter.type: ${filter.type}. Allowed types are: ${allowedTypes.join(', ')}`,
          {
            code: ErrorCode.BAD_REQUEST,
          },
        )
      }
      where.type = filter.type
    }

    // 濡傛灉绛栫暐閰嶇疆浜嗗厑璁哥殑 symbols锛屽垯杩涗竴姝ヨ繃婊?
    if (context.allowedSymbols && context.allowedSymbols.length > 0) {
      where.code = {
        in: context.allowedSymbols,
      }
    }

    const symbols = await client.symbol.findMany({
      where,
      select: {
        code: true,
        baseAsset: true,
        quoteAsset: true,
        exchange: true,
        type: true,
      },
      orderBy: { code: 'asc' },
      take: 100, // 闄愬埗杩斿洖鏁伴噺锛岄伩鍏嶈繃澶?
    })

    // 鏀寔鐨勬椂闂村懆鏈燂紙浠庣瓥鐣ラ厤缃垨榛樿鍊硷級
    const supportedTimeframes = context.allowedTimeframes ?? ['1m', '5m', '15m', '1h', '4h', '1d']

    return {
      symbols: symbols.map(s => ({
        code: s.code,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        exchange: s.exchange,
        type: s.type,
      })),
      supportedTimeframes,
    }
  }

  /**
   * 宸ュ叿 2: 鑾峰彇鍘熷甯傚満鏁版嵁锛圞绾匡級
   */
  async getMarketDataRaw(
    params: GetMarketDataRawParams,
    context: ToolExecutionContext,
  ): Promise<GetMarketDataRawResult> {
    const client = this.prisma.getClient()

    // 瑙勮寖鍖?symbol锛堝幓绌烘牸 + 澶у啓锛夛紝涓庣櫧鍚嶅崟鍙婃暟鎹簱淇濇寔涓€鑷?
    if (typeof params.symbol !== 'string' || params.symbol.trim().length === 0) {
      throw new DomainException('symbol must be a non-empty string', {
        code: ErrorCode.BAD_REQUEST,
      })
    }
    const normalizedSymbol = params.symbol.trim().toUpperCase()

    // 鏌ユ壘 symbol
    const symbol = await client.symbol.findUnique({
      where: { code: normalizedSymbol },
    })

    if (!symbol) {
      throw new DomainException(`Symbol not found: ${normalizedSymbol}`, {
        code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
        args: { symbol: normalizedSymbol },
      })
    }

    // 鏉冮檺鏍￠獙锛氭槸鍚﹀湪鍏佽鐨?symbols 涓?
    // createContext 宸茬‘淇?allowedSymbols 涓嶄负绌猴紝姝ゅ鐩存帴妫€鏌ョ櫧鍚嶅崟
    if (!context.allowedSymbols?.includes(normalizedSymbol)) {
      throw new DomainException(
        `Symbol not allowed: ${normalizedSymbol}. Allowed symbols: ${context.allowedSymbols?.join(', ')}`,
        {
          code: ErrorCode.FORBIDDEN,
          args: {
            symbol: normalizedSymbol,
            allowedSymbols: context.allowedSymbols
          },
        }
      )
    }

    // 鏉冮檺鏍￠獙锛氭槸鍚﹀湪鍏佽鐨?timeframes 涓?
    // createContext 宸茬‘淇?allowedTimeframes 涓嶄负绌猴紝姝ゅ鐩存帴妫€鏌ョ櫧鍚嶅崟
    if (!context.allowedTimeframes?.includes(params.timeframe)) {
      throw new DomainException(
        `Timeframe not allowed: ${params.timeframe}. Allowed timeframes: ${context.allowedTimeframes?.join(', ')}`,
        {
          code: ErrorCode.FORBIDDEN,
          args: {
            timeframe: params.timeframe,
            allowedTimeframes: context.allowedTimeframes
          },
        }
      )
    }

    const timeframe = mapTimeframe(params.timeframe as MarketTimeframe, ErrorCode.MARKET_INVALID_TIMEFRAME)

    // 瑙勮寖鍖?lookbackBars锛氳浆鎹负鏁存暟骞跺仛鑼冨洿鏍￠獙
    const rawLookback = params.lookbackBars ?? 100
    const lookbackBars = Math.trunc(Number(rawLookback))

    if (!Number.isFinite(lookbackBars)) {
      throw new DomainException(`Invalid lookbackBars: ${rawLookback}. Must be a finite number.`, {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 鑼冨洿鏍￠獙锛氶槻姝㈡伓鎰忔垨閿欒鐨勫弬鏁?
    if (lookbackBars < 1) {
      throw new DomainException(`Invalid lookbackBars: ${lookbackBars}, must be >= 1`, {
        code: ErrorCode.BAD_REQUEST,
      })
    }
    if (lookbackBars > 1000) {
      throw new DomainException(`lookbackBars too large: ${lookbackBars}, maximum is 1000`, {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 鏌ヨ鏈€杩戠殑 K 绾挎暟鎹?
    const bars = await client.marketBar.findMany({
      where: {
        symbolId: symbol.id,
        timeframe,
      },
      orderBy: { time: 'desc' },
      take: lookbackBars,
    })

    // 鍙嶈浆涓烘椂闂村崌搴?
    const orderedBars = bars.reverse()

    const result: GetMarketDataRawResult = {
      symbol: normalizedSymbol,
      timeframe: params.timeframe,
      bars: orderedBars.map(bar => ({
        timestamp: bar.time.getTime(),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: bar.volume != null ? Number(bar.volume) : undefined,
      })),
    }

    // 濡傛灉鎻愪緵浜?contextId锛岀紦瀛樻暟鎹緵鍚庣画寮曠敤
    if (params.contextId) {
      if (!context.sessionId) {
        throw new DomainException(
          `contextId "${params.contextId}" cannot be used without sessionId. Please supply the same sessionId for all related tool calls.`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { contextId: params.contextId },
          },
        )
      }

      result.contextId = params.contextId
      // 瀛樺偍涓?CachedMarketData 鏍煎紡锛屽寘鍚厓鏁版嵁鐢ㄤ簬鏉冮檺鏍￠獙
      const existingContext = context.dataContextCache.get(params.contextId)

      // 浼氳瘽绾у埆鐨?contextId 鏁伴噺涓婇檺锛岄槻姝㈠唴瀛樿鏃犻檺鍫嗙Н
      const maxContextsPerSession = 100
      if (!existingContext && context.dataContextCache.size >= maxContextsPerSession) {
        throw new DomainException(
          `Too many cached contexts in current session: ${context.dataContextCache.size}. Maximum allowed is ${maxContextsPerSession}. Please reuse or clear existing contextIds.`,
          {
            code: ErrorCode.BAD_REQUEST,
          },
        )
      }

      context.dataContextCache.set(params.contextId, {
        symbol: normalizedSymbol,
        timeframe: params.timeframe,
        bars: result.bars.map(b => ({
          symbol: normalizedSymbol,
          timeframe: params.timeframe,
          open: String(b.open),
          high: String(b.high),
          low: String(b.low),
          close: String(b.close),
          volume: b.volume != null ? String(b.volume) : undefined,
          timestamp: b.timestamp,
        })),
        cachedAt: Date.now(),
      })
    }

    return result
  }

  /**
   * 宸ュ叿 3: 璁＄畻鎶€鏈寚鏍?
   */
  async computeTechnicalIndicators(
    params: ComputeTechnicalIndicatorsParams,
    context: ToolExecutionContext,
  ): Promise<ComputeTechnicalIndicatorsResult> {
    // 鍩虹鍙傛暟鏍￠獙锛歩ndicators 蹇呴』鏄潪绌烘暟缁?
    if (!Array.isArray(params.indicators) || params.indicators.length === 0) {
      throw new DomainException('indicators must be a non-empty array', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 鑾峰彇鏁版嵁婧愶細浠?contextId 鎴栫洿鎺ヤ紶鍏ョ殑 bars
    let bars: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume?: number }>

    if (params.contextId) {
      if (!context.sessionId) {
        throw new DomainException(
          `contextId "${params.contextId}" cannot be used without sessionId. Please call tools with a stable sessionId.`,
          {
            code: ErrorCode.BAD_REQUEST,
            args: { contextId: params.contextId },
          },
        )
      }

      const cached = context.dataContextCache.get(params.contextId)
      if (!cached) {
        throw new DomainException(`Data context not found: ${params.contextId}`, {
          code: ErrorCode.NOT_FOUND,
        })
      }

      // 鏍￠獙缂撳瓨鐨?symbol/timeframe 鏄惁鍦ㄥ綋鍓嶇瓥鐣ョ殑鐧藉悕鍗曚腑
      if (!context.allowedSymbols?.includes(cached.symbol)) {
        throw new DomainException(
          `Cached symbol not allowed: ${cached.symbol}. Allowed symbols: ${context.allowedSymbols?.join(', ')}`,
          {
            code: ErrorCode.FORBIDDEN,
            args: {
              contextId: params.contextId,
              cachedSymbol: cached.symbol,
              allowedSymbols: context.allowedSymbols
            },
          }
        )
      }

      if (!context.allowedTimeframes?.includes(cached.timeframe)) {
        throw new DomainException(
          `Cached timeframe not allowed: ${cached.timeframe}. Allowed timeframes: ${context.allowedTimeframes?.join(', ')}`,
          {
            code: ErrorCode.FORBIDDEN,
            args: {
              contextId: params.contextId,
              cachedTimeframe: cached.timeframe,
              allowedTimeframes: context.allowedTimeframes
            },
          }
        )
      }

      bars = cached.bars.map(b => ({
        timestamp: b.timestamp,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: b.volume != null ? Number(b.volume) : undefined,
      }))
    }
    else if (params.bars != null) {
      if (!Array.isArray(params.bars) || params.bars.length === 0) {
        throw new DomainException('bars must be a non-empty array when provided', {
          code: ErrorCode.BAD_REQUEST,
        })
      }

      // 鍩虹缁撴瀯鏍￠獙锛氭瘡涓?bar 鑷冲皯闇€瑕?timestamp/open/high/low/close
      params.bars.forEach((bar, index) => {
        if (
          typeof bar !== 'object' ||
          bar === null ||
          typeof bar.timestamp !== 'number' ||
          typeof bar.open !== 'number' ||
          typeof bar.high !== 'number' ||
          typeof bar.low !== 'number' ||
          typeof bar.close !== 'number'
        ) {
          throw new DomainException(
            `Invalid bar at index ${index}: expected { timestamp, open, high, low, close } as numbers`,
            {
              code: ErrorCode.BAD_REQUEST,
            },
          )
        }
      })

      bars = params.bars

      // 涓?getMarketDataRaw 淇濇寔涓€鑷寸殑闃插尽鎬ч檺鍒讹紝闃叉 LLM 鐩存帴浼犲叆杩囧 K 绾挎嫋鍨湇鍔″櫒
      const maxBars = 1000
      if (bars.length > maxBars) {
        throw new DomainException(
          `Too many bars provided: ${bars.length}. Maximum allowed is ${maxBars}. Consider using contextId with get_market_data_raw instead.`,
          {
            code: ErrorCode.BAD_REQUEST,
          },
        )
      }
    }
    else {
      throw new DomainException('Must provide either contextId or bars', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    if (bars.length === 0) {
      throw new DomainException('No bars data available', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 娉細浠呮敮鎸佽繑鍥炴渶鏂板崟鍊硷紝瀹屾暣搴忓垪杩斿洖鍔熻兘寰呭悗缁?PR 瀹炵幇
    const results: ComputeTechnicalIndicatorsResult['indicators'] = []

    // 璁＄畻姣忎釜鎸囨爣
    for (const indicator of params.indicators) {
      if (!indicator || typeof indicator.type !== 'string') {
        throw new DomainException('Each indicator must have a valid type', {
          code: ErrorCode.BAD_REQUEST,
        })
      }

      const { type, field, params: indicatorParams } = indicator

      try {
        switch (type) {
          case 'SMA': {
            const period = (indicatorParams?.period as number) ?? 20
            const closes = bars.map(b => b.close)
            const value = sma(closes, period)
            results.push({ type, field, value: value ?? undefined })
            break
          }

          case 'EMA': {
            const period = (indicatorParams?.period as number) ?? 20
            const closes = bars.map(b => b.close)
            const value = ema(closes, period)
            results.push({ type, field, value: value ?? undefined })
            break
          }

          case 'RSI': {
            const period = (indicatorParams?.period as number) ?? 14
            const closes = bars.map(b => b.close)
            const value = rsi(closes, period)
            results.push({ type, field, value: value ?? undefined })
            break
          }

          case 'MACD': {
            const fastPeriod = (indicatorParams?.fastPeriod as number) ?? 12
            const slowPeriod = (indicatorParams?.slowPeriod as number) ?? 26
            const signalPeriod = (indicatorParams?.signalPeriod as number) ?? 9
            const closes = bars.map(b => b.close)
            const result = macd(closes, fastPeriod, slowPeriod, signalPeriod)

            if (result) {
              // 濡傛灉鎸囧畾浜?field锛岃繑鍥炲搴斿瓧娈碉紱鍚﹀垯杩斿洖鎵€鏈夊瓧娈?
              if (field === 'macd') {
                results.push({ type, field: 'macd', value: result.macd })
              }
              else if (field === 'signal') {
                results.push({ type, field: 'signal', value: result.signal })
              }
              else if (field === 'histogram') {
                results.push({ type, field: 'histogram', value: result.histogram })
              }
              else {
                // 杩斿洖鎵€鏈夊瓧娈?
                results.push({ type, field: 'macd', value: result.macd })
                results.push({ type, field: 'signal', value: result.signal })
                results.push({ type, field: 'histogram', value: result.histogram })
              }
            }
            break
          }

          case 'ATR': {
            const period = (indicatorParams?.period as number) ?? 14
            // 纭繚 bars 绗﹀悎 Bar 绫诲瀷锛坴olume 蹇呴渶锛?
            const barsWithVolume = bars.map(b => ({
              ...b,
              volume: b.volume ?? 0,
            }))
            const value = atr(barsWithVolume, period)
            results.push({ type, field, value: value ?? undefined })
            break
          }

          case 'STOCH': {
            const kPeriod = (indicatorParams?.kPeriod as number) ?? 14
            const dPeriod = (indicatorParams?.dPeriod as number) ?? 3
            // 纭繚 bars 绗﹀悎 Bar 绫诲瀷锛坴olume 蹇呴渶锛?
            const barsWithVolume = bars.map(b => ({
              ...b,
              volume: b.volume ?? 0,
            }))
            const result = stochastic(barsWithVolume, kPeriod, dPeriod)

            if (result) {
              if (field === 'k') {
                results.push({ type, field: 'k', value: result.k })
              }
              else if (field === 'd') {
                results.push({ type, field: 'd', value: result.d })
              }
              else {
                results.push({ type, field: 'k', value: result.k })
                results.push({ type, field: 'd', value: result.d })
              }
            }
            break
          }

          default:
            this.logger.warn(`Unknown indicator type: ${type}`)
        }
      }
      catch (error) {
        this.logger.error(`Failed to compute indicator ${type}: ${error}`)
        results.push({ type, field, value: undefined })
      }
    }

    return { indicators: results }
  }

  /**
   * 宸ュ叿 4: 璁＄畻閲戣瀺鎸囨爣
   */
  async computeFinancialMetrics(
    params: ComputeFinancialMetricsParams,
    _context: ToolExecutionContext,
  ): Promise<ComputeFinancialMetricsResult> {
    const normalizedReturns = this.normalizeNumberArray(params.returns, 'returns', {
      minItems: 1,
    })
    const normalizedEquityCurve = this.normalizeNumberArray(params.equityCurve, 'equityCurve', {
      minItems: 2,
    })

    let returnsArray: number[] | undefined

    // 浠?returns 鎴?equityCurve 璁＄畻鏀剁泭鐜?
    if (normalizedReturns && normalizedReturns.length > 0) {
      const returnsFormat = params.returnsFormat || 'decimal'
      returnsArray =
        returnsFormat === 'percentage'
          ? normalizedReturns.map(r => r / 100)
          : normalizedReturns
    }
    else if (normalizedEquityCurve && normalizedEquityCurve.length > 1) {
      returnsArray = this.deriveReturnsFromEquityCurve(normalizedEquityCurve)
    }
    else {
      throw new DomainException('Must provide either returns or equityCurve', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    if (!returnsArray || returnsArray.length === 0) {
      throw new DomainException('No valid returns data', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    const riskFreeRate = params.riskFreeRate ?? 0.02
    const periodsPerYear = params.periodsPerYear ?? 252

    // 璁＄畻鍚勯」鎸囨爣
    const sharpe = sharpeRatio(returnsArray, riskFreeRate, periodsPerYear)
    const annReturn = annualizedReturn(returnsArray, periodsPerYear)
    const annVol = annualizedVolatility(returnsArray, periodsPerYear)

    // 璁＄畻鏈€澶у洖鎾わ紙闇€瑕佹潈鐩婃洸绾匡級
    let maxDD: number | undefined
    let maxDDPercent: number | undefined
    if (normalizedEquityCurve && normalizedEquityCurve.length > 0) {
      const ddResult = maxDrawdown(normalizedEquityCurve)
      if (!ddResult || typeof ddResult.maxDrawdown !== 'number') {
        throw new DomainException('Unable to compute max drawdown from equityCurve', {
          code: ErrorCode.BAD_REQUEST,
        })
      }
      maxDD = ddResult.maxDrawdown
      maxDDPercent = ddResult.maxDrawdown * 100 // 杞崲涓虹櫨鍒嗘瘮
    }

    // 璁＄畻鑳滅巼鍜岀泩浜忔瘮
    const wins = returnsArray.filter(r => r > 0)
    const losses = returnsArray.filter(r => r < 0)
    const winRateValue = winRate(returnsArray)

    let profitFactor: number | undefined
    if (losses.length > 0) {
      const totalWin = wins.reduce((sum, r) => sum + r, 0)
      const totalLoss = Math.abs(losses.reduce((sum, r) => sum + r, 0))
      profitFactor = totalLoss > 0 ? totalWin / totalLoss : undefined
    }

    // Calmar Ratio = 骞村寲鏀剁泭 / 鏈€澶у洖鎾?
    let calmarRatio: number | undefined
    if (annReturn !== null && maxDD !== undefined && maxDD > 0) {
      calmarRatio = annReturn / maxDD
    }

    return {
      sharpeRatio: sharpe ?? undefined,
      maxDrawdown: maxDD,
      maxDrawdownPercent: maxDDPercent,
      annualizedReturn: annReturn ?? undefined,
      annualizedVolatility: annVol ?? undefined,
      winRate: winRateValue ?? undefined,
      profitFactor,
      calmarRatio,
    }
  }

  /**
   * 鍒涘缓宸ュ叿鎵ц涓婁笅鏂囷紙浠庢暟鎹簱鍔犺浇绛栫暐瀹炰緥閰嶇疆锛?
   *
   * 瀹夊叏娉ㄦ剰锛氭鏂规硶浠庢暟鎹簱鍔犺浇绛栫暐瀹炰緥鐨勫疄闄呴厤缃紝鑰屼笉鏄俊浠昏皟鐢ㄦ柟浼犲叆鐨勫弬鏁?
   * 杩欐牱鍙互闃叉瓒婃潈璁块棶锛堜緥濡傝鍙栨湭鎺堟潈鐨?symbols 鎴?timeframes锛?
   *
   * @param strategyInstanceId 绛栫暐瀹炰緥 ID
   * @param sessionId 浼氳瘽ID锛堢敤浜庤法宸ュ叿璋冪敤鍏变韩缂撳瓨锛屽彲閫夛級
   * @returns 鎵ц涓婁笅鏂?
   */
  async createContext(strategyInstanceId: string, sessionId?: string): Promise<ToolExecutionContext> {
    const client = this.prisma.getClient()

    // 灏濊瘯浠庢柊鐨?LLM 绛栫暐绯荤粺鍔犺浇瀹炰緥
    const llmInstance = await client.llmStrategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: {
        id: true,
        metadata: true,
        strategy: {
          select: {
            allowedSymbols: true,
            allowedTimeframes: true,
            metadata: true,
          },
        },
      },
    })

    if (llmInstance) {
      // 浣跨敤 LLM 绛栫暐瀹炰緥鐨勯厤缃紝浼樺厛璇诲彇瀹炰緥绾?metadata锛屽叾娆″洖閫€鍒扮瓥鐣ョ骇閰嶇疆
      // 鍒嗗埆 normalize 鍚勪釜鏉ユ簮锛岀‘淇濈┖鏁扮粍/闈炴硶鍊间笉浼氬睆钄藉悗缁?fallback
      const instanceMetadata = (llmInstance.metadata as any) || {}
      const strategyMetadata = (llmInstance.strategy.metadata as any) || {}

      const allowedSymbols =
        this.normalizeStringArray(instanceMetadata.allowedSymbols, {
          fieldName: 'llmStrategyInstance.metadata.allowedSymbols',
          strategyInstanceId,
          uppercase: true,
        }) ??
        this.normalizeStringArray(strategyMetadata.allowedSymbols, {
          fieldName: 'llmStrategy.metadata.allowedSymbols',
          strategyInstanceId,
          uppercase: true,
        }) ??
        this.normalizeStringArray(llmInstance.strategy.allowedSymbols, {
          fieldName: 'llmStrategy.allowedSymbols',
          strategyInstanceId,
          uppercase: true,
        })

      const allowedTimeframes =
        this.normalizeStringArray(instanceMetadata.allowedTimeframes, {
          fieldName: 'llmStrategyInstance.metadata.allowedTimeframes',
          strategyInstanceId,
        }) ??
        this.normalizeStringArray(strategyMetadata.allowedTimeframes, {
          fieldName: 'llmStrategy.metadata.allowedTimeframes',
          strategyInstanceId,
        }) ??
        this.normalizeStringArray(llmInstance.strategy.allowedTimeframes, {
          fieldName: 'llmStrategy.allowedTimeframes',
          strategyInstanceId,
        })

      if (!allowedSymbols || allowedSymbols.length === 0) {
        throw new DomainException(
          `LLM strategy instance ${strategyInstanceId} has no allowedSymbols configured.`,
          {
            code: ErrorCode.FORBIDDEN,
            args: { strategyInstanceId },
          },
        )
      }

      if (!allowedTimeframes || allowedTimeframes.length === 0) {
        throw new DomainException(
          `LLM strategy instance ${strategyInstanceId} has no allowedTimeframes configured.`,
          {
            code: ErrorCode.FORBIDDEN,
            args: { strategyInstanceId },
          },
        )
      }

      // 鑾峰彇鎴栧垱寤轰細璇濈骇缂撳瓨
      let dataContextCache: Map<string, CachedMarketData>
      if (sessionId) {
        const cacheKey = `${strategyInstanceId}:${sessionId}`
        if (!this.sessionCaches.has(cacheKey)) {
          // 妫€鏌ョ紦瀛樺ぇ灏忥紝闃叉鏃犻檺澧為暱
          if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
            this.logger.warn(
              `Cache size limit reached (${this.MAX_CACHE_ENTRIES}), forcing cleanup`,
            )
            this.cleanupExpiredCaches()

            // 濡傛灉娓呯悊鍚庝粛瓒呴檺锛岀Щ闄ゆ渶鏃х殑缂撳瓨鏉＄洰
            if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
              const entries = Array.from(this.sessionCaches.entries())
              const oldestEntry = entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)[0]

              if (oldestEntry) {
                this.sessionCaches.delete(oldestEntry[0])
                this.logger.warn(
                  `Removed oldest cache entry: ${oldestEntry[0]} (last accessed: ${new Date(oldestEntry[1].lastAccessedAt).toISOString()})`,
                )
              }
            }
          }

          this.sessionCaches.set(cacheKey, {
            strategyInstanceId,
            dataCache: new Map(),
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
          })
          this.logger.debug(`Created new session cache for key: ${cacheKey}`)
        }
        const sessionCache = this.sessionCaches.get(cacheKey)!
        if (sessionCache.strategyInstanceId !== strategyInstanceId) {
          throw new DomainException(
            `Session ${sessionId} belongs to strategy ${sessionCache.strategyInstanceId}, cannot be used by ${strategyInstanceId}`,
            {
              code: ErrorCode.FORBIDDEN,
              args: { sessionId, strategyInstanceId, owner: sessionCache.strategyInstanceId },
            },
          )
        }
        sessionCache.lastAccessedAt = Date.now()
        dataContextCache = sessionCache.dataCache
      } else {
        dataContextCache = new Map()
      }

      return {
        strategyInstanceId,
        sessionId,
        allowedSymbols,
        allowedTimeframes,
        dataContextCache,
      }
    }

    // 鍥為€€鍒版棫鐨勭瓥鐣ユā鏉跨郴缁?
    const instance = await client.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: {
        id: true,
        metadata: true,
        strategyTemplate: {
          select: {
            metadata: true,
            legs: true,
            execution: true,
            dataRequirements: true,
          },
        },
      },
    })

    if (!instance) {
      throw new DomainException(`Strategy instance not found: ${strategyInstanceId}`, {
        code: ErrorCode.NOT_FOUND,
      })
    }

    // 浠?metadata 涓彁鍙?allowedSymbols 鍜?allowedTimeframes
    // 浼樺厛浣跨敤瀹炰緥绾у埆閰嶇疆锛屽洖閫€鍒版ā鏉块厤缃?
    const instanceMetadata = (instance.metadata as any) || {}
    const templateMetadata = (instance.strategyTemplate?.metadata as any) || {}

    // 浠庢ā鏉跨殑 legs 涓彁鍙?symbols锛堝鏋?metadata 涓病鏈夐厤缃級
    const templateLegs = (instance.strategyTemplate?.legs as any) || []
    const legSymbolCandidates = Array.isArray(templateLegs)
      ? templateLegs
          .map((leg: any, index: number) => {
            if (leg && typeof leg.symbol === 'string' && leg.symbol.trim().length > 0) {
              return leg.symbol
            }
            if (leg && leg.symbol != null) {
              this.logger.warn(
                `Ignoring invalid symbol configuration in template legs at index ${index} for strategy ${strategyInstanceId}`,
              )
            }
            return undefined
          })
          .filter((symbol): symbol is string => Boolean(symbol))
      : undefined

    // 鎻愬彇鐧藉悕鍗曢厤缃紙浼樺厛绾э細瀹炰緥 metadata > 妯℃澘 metadata > 妯℃澘 legs锛?
    const allowedSymbols =
      this.normalizeStringArray(instanceMetadata.allowedSymbols, {
        fieldName: 'instance.metadata.allowedSymbols',
        strategyInstanceId,
        uppercase: true,
      }) ??
      this.normalizeStringArray(templateMetadata.allowedSymbols, {
        fieldName: 'template.metadata.allowedSymbols',
        strategyInstanceId,
        uppercase: true,
      }) ??
      this.normalizeStringArray(legSymbolCandidates, {
        fieldName: 'template.legs.symbols',
        strategyInstanceId,
        uppercase: true,
      })

    // 鎻愬彇鍏佽鐨?timeframes锛堜紭鍏堢骇锛氬疄渚?metadata > 妯℃澘 metadata > 妯℃澘 execution/dataRequirements > 榛樿鍊硷級
    let allowedTimeframes =
      this.normalizeStringArray(instanceMetadata.allowedTimeframes, {
        fieldName: 'instance.metadata.allowedTimeframes',
        strategyInstanceId,
      }) ??
      this.normalizeStringArray(templateMetadata.allowedTimeframes, {
        fieldName: 'template.metadata.allowedTimeframes',
        strategyInstanceId,
      })

    // 鍚戝悗鍏煎锛氫粠 execution 閰嶇疆涓洖閫€璇诲彇 timeframe锛堣 Prisma 娉ㄩ噴锛?
    if (!allowedTimeframes || allowedTimeframes.length === 0) {
      const templateExecution = (instance.strategyTemplate as any)?.execution
      if (templateExecution && typeof templateExecution === 'object') {
        const executionTimeframe = (templateExecution as any).timeframe
        const normalizedExecution = this.normalizeStringArray(executionTimeframe, {
          fieldName: 'template.execution.timeframe',
          strategyInstanceId,
        })
        if (normalizedExecution && normalizedExecution.length > 0) {
          allowedTimeframes = normalizedExecution
        }
      }
    }

    // 濡傛灉浠嶇劧娌℃湁閰嶇疆 timeframes锛屽垯鎷掔粷鎵ц锛岄伩鍏嶉潤榛樻斁澶х櫧鍚嶅崟
    if (!allowedTimeframes || allowedTimeframes.length === 0) {
      throw new DomainException(
        `Strategy instance ${strategyInstanceId} has no allowedTimeframes configured. ` +
        `Please configure allowedTimeframes in instance/template metadata or execution.timeframe.`,
        {
          code: ErrorCode.FORBIDDEN,
          args: { strategyInstanceId },
        },
      )
    }

    // 瀹夊叏绛栫暐锛氭湭閰嶇疆 symbols 鐧藉悕鍗曟椂鎷掔粷鎵ц锛堥粯璁ゆ嫆缁濓紝鑰岄潪榛樿鏀捐锛?
    if (!allowedSymbols || allowedSymbols.length === 0) {
      throw new DomainException(
        `Strategy instance ${strategyInstanceId} has no allowedSymbols configured. ` +
        `Please add "allowedSymbols" to instance/template metadata or define strategy legs.`,
        {
          code: ErrorCode.FORBIDDEN,
          args: { strategyInstanceId },
        }
      )
    }

    // allowedTimeframes 鐜板湪濮嬬粓鏈夊€硷紙鏉ヨ嚜 metadata/execution/榛樿鍊硷級

    // 鑾峰彇鎴栧垱寤轰細璇濈骇缂撳瓨
    let dataContextCache: Map<string, CachedMarketData>
    if (sessionId) {
      // 浣跨敤鍏变韩鐨勪細璇濈骇缂撳瓨锛堣法宸ュ叿璋冪敤澶嶇敤锛?
      // 缂撳瓨 key 鍖呭惈 strategyInstanceId锛岄槻姝㈣法绛栫暐绐滆
      const cacheKey = `${strategyInstanceId}:${sessionId}`

      if (!this.sessionCaches.has(cacheKey)) {
        // 妫€鏌ョ紦瀛樺ぇ灏忥紝闃叉鏃犻檺澧為暱
        if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
          this.logger.warn(
            `Cache size limit reached (${this.MAX_CACHE_ENTRIES}), forcing cleanup`,
          )
          this.cleanupExpiredCaches()

          // 濡傛灉娓呯悊鍚庝粛瓒呴檺锛岀Щ闄ゆ渶鏃х殑缂撳瓨鏉＄洰
          if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
            const entries = Array.from(this.sessionCaches.entries())
            const oldestEntry = entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)[0]

            if (oldestEntry) {
              this.sessionCaches.delete(oldestEntry[0])
              this.logger.warn(
                `Removed oldest cache entry: ${oldestEntry[0]} (last accessed: ${new Date(oldestEntry[1].lastAccessedAt).toISOString()})`,
              )
            }
          }
        }

        this.sessionCaches.set(cacheKey, {
          strategyInstanceId,
          dataCache: new Map(),
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        })
        this.logger.debug(`Created new session cache for key: ${cacheKey}`)
      }

      const sessionCache = this.sessionCaches.get(cacheKey)!

      // 楠岃瘉 strategyInstanceId 鍖归厤锛堥槻姝?sessionId 璇敤锛?
      if (sessionCache.strategyInstanceId !== strategyInstanceId) {
        throw new DomainException(
          `Session ${sessionId} belongs to strategy ${sessionCache.strategyInstanceId}, cannot be used by ${strategyInstanceId}`,
          {
            code: ErrorCode.FORBIDDEN,
            args: { sessionId, strategyInstanceId, owner: sessionCache.strategyInstanceId },
          }
        )
      }

      // 鏇存柊鏈€鍚庤闂椂闂?
      sessionCache.lastAccessedAt = Date.now()
      dataContextCache = sessionCache.dataCache
    }
    else {
      // 鏃?sessionId锛屼娇鐢ㄤ复鏃剁紦瀛橈紙涓嶈法宸ュ叿璋冪敤锛?
      dataContextCache = new Map()
    }

    return {
      strategyInstanceId,
      sessionId,
      allowedSymbols,
      allowedTimeframes,
      dataContextCache,
    }
  }
}
