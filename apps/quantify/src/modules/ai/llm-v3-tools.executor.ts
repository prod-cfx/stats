/**
 * LLM Orchestrated Engine v3 - Function Calling Tools Executor
 *
 * 实现 v3 引擎工具的执行逻辑
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
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 MarketDataReadGateway
import { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 PrismaService
import { PrismaService } from '@/prisma/prisma.service'

/**
 * 工具执行上下文（用于存储中间数据）
 */
interface ToolExecutionContext {
  /** 策略实例 ID（用于权限校验） */
  strategyInstanceId: string
  /** 会话 ID（用于跨工具调用共享缓存） */
  sessionId?: string
  /** 允许的 symbols（从策略配置中获取） */
  allowedSymbols?: string[]
  /** 允许的 timeframes（从策略配置中获取） */
  allowedTimeframes?: string[]
  /** 数据上下文缓存（contextId -> cached data with metadata） */
  dataContextCache: Map<string, CachedMarketData>
}

/**
 * 缓存的市场数据（包含元数据用于权限校验）
 */
interface CachedMarketData {
  /** 标的代码 */
  symbol: string
  /** 时间周期 */
  timeframe: string
  /** K 线数量 */
  bars: MarketBarPayload[]
  /** 缓存时间戳（用于 TTL） */
  cachedAt: number
}

/**
 * 会话缓存元数据
 */
interface SessionCacheMetadata {
  /** 策略实例 ID（用于隔离不同策略的缓存） */
  strategyInstanceId: string
  /** 数据上下文缓存 */
  dataCache: Map<string, CachedMarketData>
  /** 创建时间 */
  createdAt: number
  /** 最后访问时间 */
  lastAccessedAt: number
}

@Injectable()
export class LlmV3ToolsExecutor implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(LlmV3ToolsExecutor.name)

  /**
   * 会话级数据缓存（跨工具调用共享）
   * Key: `${strategyInstanceId}:${sessionId}`, Value: SessionCacheMetadata
   */
  private readonly sessionCaches = new Map<string, SessionCacheMetadata>()

  /**
   * 缓存 TTL（毫秒）- 默认 1 小时
   */
  private readonly CACHE_TTL_MS = 60 * 60 * 1000

  /**
   * 缓存清理间隔（毫秒）- 默认 5 分钟
   */
  private readonly CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

  /**
   * 最大缓存条目数，防止无限增长
   */
  private readonly MAX_CACHE_ENTRIES = 1000

  /**
   * 定时清理任务句柄
   */
  private cacheCleanupInterval?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataReadGateway: MarketDataReadGateway,
  ) {
    // 启动定时清理任务
    this.startCacheCleanupTimer()
  }

  /**
   * 启动缓存自动清理定时器
   */
  private startCacheCleanupTimer(): void {
    if (this.cacheCleanupInterval) {
      return
    }

    const interval = setInterval(() => {
      this.cleanupExpiredCaches()
    }, this.CACHE_CLEANUP_INTERVAL_MS)

    // 避免阻塞测试或脚本进程退出
    interval.unref?.()

    this.cacheCleanupInterval = interval
  }

  /**
   * 停止缓存清理定时器
   */
  private stopCacheCleanupTimer(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
      this.cacheCleanupInterval = undefined
    }
  }

  /**
   * 清理过期的缓存
   */
  private cleanupExpiredCaches(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, metadata] of this.sessionCaches.entries()) {
      // 清理超过 TTL 的缓存
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
   * 执行工具调用（主入口）
   * @param toolName 工具名称
   * @param params 工具参数
   * @param strategyInstanceId 策略实例 ID（用于加载白名单配置）
   * @param sessionId 会话ID（用于跨工具调用共享缓存，可选）
   * @returns 工具执行结果
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

    // 服务端强制加入 context，不信任调用方传入的配置
    // 如果提供 sessionId，则使用共享缓存
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
   * 清理会话缓存（在策略执行完成后调用）
   * @param strategyInstanceId 策略实例ID
   * @param sessionId 会话ID
   */
  clearSessionCache(strategyInstanceId: string, sessionId: string): void {
    const cacheKey = `${strategyInstanceId}:${sessionId}`
    this.sessionCaches.delete(cacheKey)
    this.logger.debug(`Cleared session cache for key: ${cacheKey}`)
  }

  /**
   * 将输入规范化为字符串数组，并对非法配置给出明确错误
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
   * 将输入规范化为数字数组，并对非法值抛出 DomainException
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
   * 根据权益曲线推导收益率序列
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
   * 工具 1: 获取策略允许的交易标的和时间框架
   */
  async getSymbolUniverse(
    params: GetSymbolUniverseParams,
    context: ToolExecutionContext,
  ): Promise<GetSymbolUniverseResult> {
    const client = this.prisma.getClient()

    // 构建查询条件
    const where: Prisma.SymbolWhereInput = {
      status: 'ACTIVE',
    }

    const filter = params.filter

    // 运行时校验：exchange/baseAsset 必须是非空字符串
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

    // 运行时校验：type 仅允许合法枚举值（与现有 Symbol.type 匹配）
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

    // 如果策略配置了允许的 symbols，则进一步过滤
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
      take: 100, // 限制返回数量，避免过大
    })

    // 支持的时间周期（从策略配置或默认值）
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
   * 工具 2: 获取原始市场数据（K线）
   */
  async getMarketDataRaw(
    params: GetMarketDataRawParams,
    context: ToolExecutionContext,
  ): Promise<GetMarketDataRawResult> {
    const client = this.prisma.getClient()

    // 规范化 symbol（去空格 + 大写），与白名单及数据库保持一致
    if (typeof params.symbol !== 'string' || params.symbol.trim().length === 0) {
      throw new DomainException('symbol must be a non-empty string', {
        code: ErrorCode.BAD_REQUEST,
      })
    }
    const normalizedSymbol = params.symbol.trim().toUpperCase()

    // 查找 symbol
    const symbol = await client.symbol.findUnique({
      where: { code: normalizedSymbol },
    })

    if (!symbol) {
      throw new DomainException(`Symbol not found: ${normalizedSymbol}`, {
        code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
        args: { symbol: normalizedSymbol },
      })
    }

    // 权限校验：是否在允许的 symbols 中
    // createContext 已确认 allowedSymbols 不为空，此处直接检查白名单
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

    // 权限校验：是否在允许的 timeframes 中
    // createContext 已确认 allowedTimeframes 不为空，此处直接检查白名单
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

    // 规范化 lookbackBars：转换为整数并做范围校验
    const rawLookback = params.lookbackBars ?? 100
    const lookbackBars = Math.trunc(Number(rawLookback))

    if (!Number.isFinite(lookbackBars)) {
      throw new DomainException(`Invalid lookbackBars: ${rawLookback}. Must be a finite number.`, {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 范围校验：防止恶意或错误的参数
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

    const orderedBars = await this.marketDataReadGateway.getRecentBars(
      normalizedSymbol,
      params.timeframe as MarketTimeframe,
      lookbackBars,
    )

    const result: GetMarketDataRawResult = {
      symbol: normalizedSymbol,
      timeframe: params.timeframe,
      bars: orderedBars.map(bar => ({
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: Number.isFinite(bar.volume) ? bar.volume : undefined,
      })),
    }

    // 如果提供 contextId，缓存数据供后续引用
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
      // 存储为 CachedMarketData 格式，包含元数据用于权限校验
      const existingContext = context.dataContextCache.get(params.contextId)

      // 会话级别的 contextId 数量上限，防止内存被无限堆积
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
   * 工具 3: 计算技术指标
   */
  async computeTechnicalIndicators(
    params: ComputeTechnicalIndicatorsParams,
    context: ToolExecutionContext,
  ): Promise<ComputeTechnicalIndicatorsResult> {
    // 基础参数校验：indicators 必须是非空数组
    if (!Array.isArray(params.indicators) || params.indicators.length === 0) {
      throw new DomainException('indicators must be a non-empty array', {
        code: ErrorCode.BAD_REQUEST,
      })
    }

    // 获取数据源：来自 contextId 或直接传入的 bars
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

      // 校验缓存的 symbol/timeframe 是否在当前策略的白名单中
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

      // 基础结构校验：每个 bar 至少需要 timestamp/open/high/low/close
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

      // 与 getMarketDataRaw 保持一致的防御性限制，防止 LLM 直接传入过多 K 线拖垮服务器
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

    // 注：仅支持返回最新单值，完整序列返回功能待后续 PR 实现
    const results: ComputeTechnicalIndicatorsResult['indicators'] = []

    // 计算每个指标
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
              // 如果指定 field，返回对应字段；否则返回所有字段
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
                // 返回所有字段
                results.push({ type, field: 'macd', value: result.macd })
                results.push({ type, field: 'signal', value: result.signal })
                results.push({ type, field: 'histogram', value: result.histogram })
              }
            }
            break
          }

          case 'ATR': {
            const period = (indicatorParams?.period as number) ?? 14
            // 确保 bars 符合 Bar 类型（volume 必需）
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
            // 确保 bars 符合 Bar 类型（volume 必需）
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
   * 工具 4: 计算金融指标
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

    // 从 returns 或 equityCurve 计算收益率
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

    // 计算各项指标
    const sharpe = sharpeRatio(returnsArray, riskFreeRate, periodsPerYear)
    const annReturn = annualizedReturn(returnsArray, periodsPerYear)
    const annVol = annualizedVolatility(returnsArray, periodsPerYear)

    // 计算最大回撤（需要权益曲线）
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
      maxDDPercent = ddResult.maxDrawdown * 100 // 转换为百分比
    }

    // 计算胜率和盈亏比
    const wins = returnsArray.filter(r => r > 0)
    const losses = returnsArray.filter(r => r < 0)
    const winRateValue = winRate(returnsArray)

    let profitFactor: number | undefined
    if (losses.length > 0) {
      const totalWin = wins.reduce((sum, r) => sum + r, 0)
      const totalLoss = Math.abs(losses.reduce((sum, r) => sum + r, 0))
      profitFactor = totalLoss > 0 ? totalWin / totalLoss : undefined
    }

    // Calmar Ratio = 年化收益 / 最大回撤
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
   * 创建工具执行上下文（从数据库加载策略实例配置）
   *
   * 安全注意：此方法从数据库加载策略实例的实际配置，而不是信任调用方传入的参数。
   * 这样可以防止越权访问（例如读取未授权的 symbols 或 timeframes）。
   *
   * @param strategyInstanceId 策略实例 ID
   * @param sessionId 会话ID（用于跨工具调用共享缓存，可选）
   * @returns 执行上下文
   */
  async createContext(strategyInstanceId: string, sessionId?: string): Promise<ToolExecutionContext> {
    const client = this.prisma.getClient()

    // 尝试从新的 LLM 策略系统加载实例
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
      // 使用 LLM 策略实例的配置，优先读取实例 metadata，其次回退到策略级配置
      // 分别 normalize 各个来源，确保空数组或非法值不会屏蔽后续 fallback
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

      // 获取或创建会话级缓存
      let dataContextCache: Map<string, CachedMarketData>
      if (sessionId) {
        const cacheKey = `${strategyInstanceId}:${sessionId}`
        if (!this.sessionCaches.has(cacheKey)) {
          // 检查缓存大小，防止无限增长
          if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
            this.logger.warn(
              `Cache size limit reached (${this.MAX_CACHE_ENTRIES}), forcing cleanup`,
            )
            this.cleanupExpiredCaches()

            // 如果清理后仍超限，移除最旧的缓存条目
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

    // 回退到旧的策略模板系统
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

    // 从 metadata 中提取 allowedSymbols 和 allowedTimeframes
    // 优先使用实例级别配置，回退到模板配置
    const instanceMetadata = (instance.metadata as any) || {}
    const templateMetadata = (instance.strategyTemplate?.metadata as any) || {}

    // 从模板的 legs 中提取 symbols（如果 metadata 中没有配置）
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

    // 提取白名单配置（优先级：实例 metadata > 模板 metadata > 模板 legs）
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

    // 提取允许的 timeframes（优先级：实例 metadata > 模板 metadata > 模板 execution/dataRequirements > 默认值）
    let allowedTimeframes =
      this.normalizeStringArray(instanceMetadata.allowedTimeframes, {
        fieldName: 'instance.metadata.allowedTimeframes',
        strategyInstanceId,
      }) ??
      this.normalizeStringArray(templateMetadata.allowedTimeframes, {
        fieldName: 'template.metadata.allowedTimeframes',
        strategyInstanceId,
      })

    // 向后兼容：从 execution 配置中回退读取 timeframe（见 Prisma 注释）
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

    // 如果仍然没有配置 timeframes，则拒绝执行，避免静默放大白名单
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

    // 安全策略：未配置 symbols 白名单时拒绝执行（默认拒绝，而非默认放行）
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

    // allowedTimeframes 现在始终有值（来自 metadata/execution/默认值）

    // 获取或创建会话级缓存
    let dataContextCache: Map<string, CachedMarketData>
    if (sessionId) {
      // 使用共享的会话级缓存（跨工具调用复用）
      // 缓存 key 包含 strategyInstanceId，防止跨策略窜读
      const cacheKey = `${strategyInstanceId}:${sessionId}`

      if (!this.sessionCaches.has(cacheKey)) {
        // 检查缓存大小，防止无限增长
        if (this.sessionCaches.size >= this.MAX_CACHE_ENTRIES) {
          this.logger.warn(
            `Cache size limit reached (${this.MAX_CACHE_ENTRIES}), forcing cleanup`,
          )
          this.cleanupExpiredCaches()

          // 如果清理后仍超限，移除最旧的缓存条目
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

      // 验证 strategyInstanceId 匹配（防止 sessionId 误用）
      if (sessionCache.strategyInstanceId !== strategyInstanceId) {
        throw new DomainException(
          `Session ${sessionId} belongs to strategy ${sessionCache.strategyInstanceId}, cannot be used by ${strategyInstanceId}`,
          {
            code: ErrorCode.FORBIDDEN,
            args: { sessionId, strategyInstanceId, owner: sessionCache.strategyInstanceId },
          }
        )
      }

      // 更新最后访问时间
      sessionCache.lastAccessedAt = Date.now()
      dataContextCache = sessionCache.dataCache
    }
    else {
      // 无 sessionId，使用临时缓存（不跨工具调用）
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
