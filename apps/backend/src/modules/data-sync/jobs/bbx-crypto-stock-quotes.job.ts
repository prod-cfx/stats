import type { DataPullJob, DataPullJobContext, JobMetaSchema, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService 和 CryptoStockQuotesRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { BbxSigner } from '@/clients/bbx'
// eslint-disable-next-line ts/consistent-type-imports
import { CryptoStockQuotesRepository } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.repository'

/**
 * BBX API 返回的加密股票报价数据结构
 * 
 * 说明：
 * - 这个接口定义基于常见的加密股票报价 API 格式
 * - 实际使用时需要根据 BBX API 文档调整字段
 */
interface BbxCryptoStockQuote {
  symbol: string
  name?: string
  exchange?: string
  price: number | string
  open?: number | string
  high?: number | string
  low?: number | string
  close?: number | string
  volume?: number | string
  turnover?: number | string
  change?: number | string
  changePercent?: number | string
  marketCap?: number | string
  peRatio?: number | string
  high52w?: number | string
  low52w?: number | string
  timestamp?: number | string
  [key: string]: any
}

interface BbxApiResponse {
  code?: number | string
  message?: string
  data?: BbxCryptoStockQuote[] | BbxCryptoStockQuote
  success?: boolean
  [key: string]: any
}

interface BbxJobCursor {
  lastFetchTime?: string
  // symbols 不再保存在 cursor 中，确保每次都从配置读取
}

/**
 * 任务级配置参数（存放在 data_pull_tasks.meta 中）
 */
interface BbxCryptoStockQuotesMeta {
  /**
   * 需要拉取的股票代码列表（推荐使用大写，如 "MSTR"、"COIN"）
   */
  symbols?: string[]
  /**
   * 需要拉取的股票代码列表（逗号分隔字符串形式，兼容性字段）
   *
   * 例如："MSTR,COIN,MARA"
   */
  symbolsCsv?: string
}

/**
 * BBX 加密股票报价数据拉取 Job
 *
 * 功能：
 * - 定期从 BBX API 拉取加密股票报价数据
 * - 支持多个股票代码同时拉取
 * - 自动去重和更新数据
 *
 * 配置：
 * - BBX_ACCESS_KEY_ID: BBX API 访问密钥 ID
 * - BBX_ACCESS_SECRET: BBX API 访问密钥
 * - BBX_CRYPTO_STOCK_ENDPOINT: BBX API 端点（可选，默认 https://open.bbx.com/api/upgrade/v2/crypto_stock/quotes）
 * - data_pull_tasks.meta.symbols / symbolsCsv: 需要拉取的股票代码列表（优先）
 * - BBX_CRYPTO_STOCK_SYMBOLS: 兼容性环境变量（逗号分隔列表，将在后续版本中废弃）
 */
@Injectable()
export class BbxCryptoStockQuotesJob implements DataPullJob<BbxCryptoStockQuotesMeta> {
  readonly key = 'bbx-crypto-stock-quotes'
  readonly name = 'BBX 加密股票报价数据'
  readonly metaSchema: JobMetaSchema = {
    description: '从 BBX API 拉取指定加密股票的实时报价数据',
    fields: [
      {
        name: 'symbols',
        type: 'array',
        required: false,
        description: '股票代码列表（数组形式，如 ["MSTR","COIN","MARA"]）',
        defaultValue: [],
      },
      {
        name: 'symbolsCsv',
        type: 'string',
        required: false,
        description: '股票代码列表（逗号分隔字符串形式，如 "MSTR,COIN,MARA"）',
        defaultValue: '',
      },
    ],
    example: {
      symbols: ['MSTR', 'COIN', 'MARA'],
      symbolsCsv: 'MSTR,COIN,MARA',
    },
  }
  private readonly logger = new Logger(BbxCryptoStockQuotesJob.name)
  private readonly requestTimeoutMs = 15_000
  private readonly maxAttempts = 3

  constructor(
    private readonly configService: ConfigService,
    private readonly repo: CryptoStockQuotesRepository,
  ) {}

  async run(ctx: DataPullJobContext<BbxCryptoStockQuotesMeta>): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const accessKeyId = this.configService.get<string>('BBX_ACCESS_KEY_ID')
    const accessSecret = this.configService.get<string>('BBX_ACCESS_SECRET')
    const rawEndpoint = this.configService.get<string>('BBX_CRYPTO_STOCK_ENDPOINT')
    // 使用 || 确保空字符串也回退到默认值
    const endpoint = rawEndpoint?.trim() || 'https://open.bbx.com/api/upgrade/v2/crypto_stock/quotes'

    if (!accessKeyId || !accessSecret) {
      throw new Error('BBX_ACCESS_KEY_ID and BBX_ACCESS_SECRET are required')
    }

    const signer = new BbxSigner(accessKeyId, accessSecret)

    // 从任务级 meta 中解析要拉取的股票代码列表（每次执行都从 meta 读取，确保可动态调整）
    let symbols = this.resolveSymbols(ctx.meta)

    // 兼容逻辑：若任务 meta 未配置 symbols，则回退到环境变量 BBX_CRYPTO_STOCK_SYMBOLS
    if (symbols.length === 0) {
      const symbolsConfig = this.configService.get<string>('BBX_CRYPTO_STOCK_SYMBOLS')

      if (symbolsConfig) {
        symbols = symbolsConfig
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => s.toUpperCase())

        // 提示即将废弃的配置方式，便于后续迁移到 meta
        this.logger.warn(
          'BBX_CRYPTO_STOCK_SYMBOLS is deprecated, please migrate to data_pull_tasks.meta.symbols / symbolsCsv',
          {
            envSymbols: symbols,
            taskId: ctx.taskId,
            key: ctx.key,
          },
        )
      }
    }

    if (symbols.length === 0) {
      throw new Error(
        'BBX crypto stock symbols are not configured. Please set data_pull_tasks.meta.symbols / symbolsCsv or BBX_CRYPTO_STOCK_SYMBOLS env.',
      )
    }

    // 将 symbol 转换为 BBX ticker 格式: MSTR -> i:mstr:nasdaq
    const tickers = symbols.map(s => `i:${s.toLowerCase()}:nasdaq`)
    this.logger.log(`Fetching BBX crypto stock quotes for tickers: ${tickers.join(', ')}`)

    const url = new URL(endpoint)
    // BBX API 使用 tickers 参数，格式为 i:symbol:exchange
    url.searchParams.set('tickers', tickers.join(','))

    const json = await this.fetchQuotesJson(url, signer)

    // 检查 BBX API 业务错误码
    if (json.success === false || (json.code && json.code !== 0 && json.code !== '0')) {
      const errorMsg = `BBX API returned error: code=${json.code}, message=${json.message ?? 'unknown'}`
      this.logger.error(errorMsg, { response: json })
      throw new Error(errorMsg)
    }

    // 根据实际的 BBX API 响应格式调整解析逻辑
    const quotes = this.parseApiResponse(json)

    if (quotes.length === 0) {
      this.logger.warn('No quotes returned from BBX API', {
        code: json.code,
        message: json.message,
      })
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ ...cursor, lastFetchTime: new Date().toISOString() }),
        meta: {
          note: 'No quotes returned',
          code: json.code,
          message: json.message,
        },
      }
    }

    // 数据完整性检查：验证是否所有配置的 symbols 都有返回数据
    const returnedSymbols = new Set(quotes.map(q => q.symbol.toUpperCase()))
    const missingSymbols = symbols.filter(s => !returnedSymbols.has(s.toUpperCase()))

    if (missingSymbols.length > 0) {
      const errorMsg = `BBX API missing data for symbols: ${missingSymbols.join(', ')}`
      this.logger.error(errorMsg, {
        configured: symbols,
        returned: Array.from(returnedSymbols),
        missing: missingSymbols,
      })
      // 记录缺失但不中断任务，让部分数据能写入
    }

    // 批量入库（parseTimestamp 会在 timestamp 缺失/无效时抛错，阻止写入脏数据）
    const count = await this.repo.upsertQuotes(
      quotes.map(quote => ({
        symbol: quote.symbol,
        name: quote.name ?? null,
        exchange: quote.exchange ?? null,
        price: quote.price,
        openPrice: quote.open ?? null,
        highPrice: quote.high ?? null,
        lowPrice: quote.low ?? null,
        closePrice: quote.close ?? null,
        volume: quote.volume ?? null,
        turnover: quote.turnover ?? null,
        priceChange: quote.change ?? null,
        priceChangePercent: quote.changePercent ?? null,
        marketCap: quote.marketCap ?? null,
        peRatio: quote.peRatio ?? null,
        high52Week: quote.high52w ?? null,
        low52Week: quote.low52w ?? null,
        source: 'BBX',
        quoteTimestamp: this.parseTimestamp(quote.timestamp, quote.symbol),
        rawData: quote,
      })),
    )

    const newCursor: BbxJobCursor = {
      lastFetchTime: new Date().toISOString(),
      // 不再保存 symbols 到 cursor，确保每次都从配置读取
    }

    return {
      fetchedCount: count,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbols: quotes.map(q => q.symbol),
        fetchTime: newCursor.lastFetchTime,
        configuredSymbols: symbols, // 记录实际生效的配置列表
        missingSymbols: missingSymbols.length > 0 ? missingSymbols : undefined, // 记录缺失的标的
      },
    }
  }

  /**
   * 从任务级 meta 中解析股票代码列表
   *
   * 支持两种配置方式：
   * - symbols: 字符串数组
   * - symbolsCsv: 逗号分隔字符串
   *
   * 返回去重且剔除空字符串后的列表
   */
  private resolveSymbols(meta: BbxCryptoStockQuotesMeta | null): string[] {
    if (!meta) return []

    const symbols: string[] = []

    // symbols 数组形式
    if (Array.isArray(meta.symbols)) {
      for (const item of meta.symbols) {
        if (typeof item === 'string') {
          const trimmed = item.trim()
          if (trimmed) {
            symbols.push(trimmed)
          }
        }
      }
    }

    // symbolsCsv 逗号分隔形式
    if (typeof meta.symbolsCsv === 'string' && meta.symbolsCsv.trim()) {
      const parts = meta.symbolsCsv
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      symbols.push(...parts)
    }

    if (!symbols.length) return []
    // 去重，统一转为大写便于后续比较
    return Array.from(new Set(symbols.map(s => s.toUpperCase())))
  }

  /**
   * 解析 API 响应，提取报价数据
   */
  private parseApiResponse(response: BbxApiResponse): BbxCryptoStockQuote[] {
    // 根据实际的 BBX API 响应格式调整解析逻辑
    
    // 尝试多种可能的响应格式
    if (Array.isArray(response.data)) {
      return response.data
    }

    if (response.data && typeof response.data === 'object') {
      return [response.data]
    }

    if (Array.isArray(response)) {
      return response
    }

    // 如果响应本身就是报价对象
    if (response.symbol) {
      return [response as BbxCryptoStockQuote]
    }

    this.logger.warn('Unexpected API response format', response)
    return []
  }

  /**
   * 解析时间戳
   * 支持：数字（秒/毫秒）、字符串形式的 epoch、ISO 8601 字符串
   * @throws Error 当 timestamp 缺失或无法解析时抛出错误
   */
  private parseTimestamp(timestamp?: number | string, symbol?: string): Date {
    if (!timestamp) {
      const errorMsg = symbol 
        ? `Missing timestamp for symbol ${symbol}` 
        : 'Missing timestamp in API response'
      throw new Error(errorMsg)
    }

    // 处理数字类型的 timestamp
    if (typeof timestamp === 'number') {
      // 判断是秒还是毫秒
      const ts = timestamp > 1e12 ? timestamp : timestamp * 1000
      const date = new Date(ts)

      // 验证日期是否有效
      if (Number.isNaN(date.getTime())) {
        const errorMsg = symbol
          ? `Invalid timestamp ${timestamp} for symbol ${symbol}`
          : `Invalid timestamp ${timestamp} in API response`
        throw new Error(errorMsg)
      }
      
      return date
    }

    // 处理字符串形式的 epoch timestamp（如 "1703607900"）
    if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
      const num = Number(timestamp)
      const ts = num > 1e12 ? num : num * 1000
      const date = new Date(ts)

      // 验证日期是否有效
      if (Number.isNaN(date.getTime())) {
        const errorMsg = symbol
          ? `Invalid timestamp ${timestamp} for symbol ${symbol}`
          : `Invalid timestamp ${timestamp} in API response`
        throw new Error(errorMsg)
      }
      
      return date
    }

    // 尝试解析为 ISO 8601 或其他日期字符串
    const parsed = new Date(timestamp)

    if (Number.isNaN(parsed.getTime())) {
      const errorMsg = symbol
        ? `Cannot parse timestamp "${timestamp}" for symbol ${symbol}`
        : `Cannot parse timestamp "${timestamp}" in API response`
      throw new Error(errorMsg)
    }
    
    return parsed
  }

  /**
   * 调用 BBX API 获取报价数据
   */
  private async fetchQuotesJson(url: URL, signer: BbxSigner): Promise<BbxApiResponse> {
    // 生成 BBX 签名认证参数并添加到 URL 查询参数
    const authParams = signer.generateAuthHeaders()
    url.searchParams.set('AccessKeyId', authParams.AccessKeyId)
    url.searchParams.set('SignatureNonce', authParams.SignatureNonce)
    url.searchParams.set('Timestamp', authParams.Timestamp)
    url.searchParams.set('Signature', authParams.Signature)

    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }

    let lastFailure: string | null = null

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs)

      try {
        const response = await fetch(url.toString(), {
          ...requestInit,
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await this.safeReadText(response)
          const snippet = body ? body.slice(0, 500) : ''

          const failure = `status=${response.status} ${response.statusText}${snippet ? ` body=${JSON.stringify(snippet)}` : ''}`
          lastFailure = failure

          const retryable = response.status >= 500 || response.status === 429
          if (retryable && attempt < this.maxAttempts) {
            this.logger.warn(
              `BBX API request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            // 等待一段时间后重试
            await this.delay(1000 * attempt)
            continue
          }

          throw new Error(
            `BBX API request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as BbxApiResponse
      } catch (error) {
        const isAbort = this.isAbortError(error)

        const failure = isAbort
          ? `timeout after ${this.requestTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error)

        lastFailure = failure

        if (attempt < this.maxAttempts) {
          this.logger.warn(
            `BBX API request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          await this.delay(1000 * attempt)
          continue
        }

        throw new Error(
          `BBX API request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `BBX API request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    if (!('name' in error)) return false
    return (error as { name?: unknown }).name === 'AbortError'
  }

  private async safeReadText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  private parseCursor(currentCursor: string | null): BbxJobCursor {
    if (!currentCursor) {
      return {}
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<BbxJobCursor>
      return parsed as BbxJobCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {}
    }
  }
}

