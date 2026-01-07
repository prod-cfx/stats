import type { TradesPairConfig } from '@prisma/client'
import type { CreateTradesPairConfigDto } from '../dto/create-trades-pair-config.dto'
import type { QueryTradesPairConfigDto } from '../dto/query-trades-pair-config.dto'
import type { UpdateTradesPairConfigDto } from '../dto/update-trades-pair-config.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// Nest 注入需要运行时引用 Repository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { TradesPairConfigRepository } from '../repositories/trades-pair-config.repository'

@Injectable()
export class TradesPairConfigService {
  constructor(
    private readonly repository: TradesPairConfigRepository,
  ) {}

  async findAll(filter?: QueryTradesPairConfigDto): Promise<TradesPairConfig[]> {
    return this.repository.findAll(filter)
  }

  async findById(id: string): Promise<TradesPairConfig> {
    const config = await this.repository.findById(id)
    if (!config) {
      throw new DomainException('Trades pair config not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return config
  }

  async findEnabledConfigs(): Promise<TradesPairConfig[]> {
    return this.repository.findEnabledConfigs()
  }

  async create(dto: CreateTradesPairConfigDto): Promise<TradesPairConfig> {
    // 验证 pairId 与其他字段的一致性
    const expectedPairId = `${dto.symbol.toUpperCase()}.${dto.exchange.toUpperCase()}.${dto.instrumentType}`
    if (dto.pairId !== expectedPairId) {
      throw new DomainException(
        `pairId 必须与 symbol/exchange/instrumentType 一致。期望: ${expectedPairId}，实际: ${dto.pairId}`,
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        },
      )
    }

    // 避免 symbol 与 base/quote 不一致导致订阅到错误 instId（尤其是 resolveOkxInstId 主要依赖 base/quote 推导）
    this.assertOkxPairFieldsConsistent({
      exchange: dto.exchange,
      instrumentType: dto.instrumentType,
      symbol: dto.symbol,
      baseAsset: dto.baseAsset,
      quoteAsset: dto.quoteAsset,
      metadata: dto.metadata,
    })

    // 检查 pairId 是否已存在
    const existing = await this.repository.findByPairId(dto.pairId)
    if (existing) {
      throw new DomainException('Pair ID already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    // 解析 canonical OKX instId（需与 OkxTradesWsAdapterBase.resolveInstId 保持语义一致）
    const canonicalInstId = this.resolveOkxInstId({
      exchange: dto.exchange,
      instrumentType: dto.instrumentType,
      symbol: dto.symbol,
      baseAsset: dto.baseAsset,
      quoteAsset: dto.quoteAsset,
      metadata: dto.metadata,
    })

    if (!canonicalInstId) {
      throw new DomainException(
        '无法解析 OKX instId，请检查 symbol/baseAsset/quoteAsset 或在 metadata 中提供 okxInstId/okxContract',
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        },
      )
    }

    // 检查是否存在使用相同 canonical instId 的其他配置，避免 silent duplicate
    const sameExchangeConfigs = await this.repository.findAll({
      exchange: dto.exchange,
      instrumentType: dto.instrumentType,
    })

    for (const cfg of sameExchangeConfigs) {
      const cfgInstId = this.resolveOkxInstId({
        exchange: cfg.exchange,
        instrumentType: cfg.instrumentType as CreateTradesPairConfigDto['instrumentType'],
        symbol: cfg.symbol,
        baseAsset: cfg.baseAsset,
        quoteAsset: cfg.quoteAsset,
        metadata: cfg.metadata ?? undefined,
      })

      if (cfgInstId && cfgInstId === canonicalInstId) {
        throw new DomainException(
          `已经存在使用相同 OKX instId 的订阅配置：instId=${canonicalInstId}（pairId=${cfg.pairId}）`,
          {
            code: ErrorCode.CONFLICT,
            status: HttpStatus.CONFLICT,
          },
        )
      }
    }

    try {
      return await this.repository.create(dto, canonicalInstId)
    }
    catch (error: any) {
      // 捕获 Prisma 唯一约束冲突（并发情况下可能通过前置检查）
      if (error?.code === 'P2002') {
        const target = error?.meta?.target
        if (Array.isArray(target) && target.includes('symbol')) {
          throw new DomainException(
            `该交易对配置已存在：${dto.symbol} @ ${dto.exchange} (${dto.instrumentType})`,
            {
              code: ErrorCode.CONFLICT,
              status: HttpStatus.CONFLICT,
            },
          )
        }
        throw new DomainException('Pair ID already exists', {
          code: ErrorCode.CONFLICT,
          status: HttpStatus.CONFLICT,
        })
      }
      throw error
    }
  }

  async update(id: string, dto: UpdateTradesPairConfigDto): Promise<TradesPairConfig> {
    // 确保配置存在
    const existing = await this.findById(id)

    // 合并后的“预期配置”，用于校验 metadata 变更是否导致 instId 解析失败或冲突
    const merged = {
      exchange: existing.exchange,
      instrumentType: existing.instrumentType as CreateTradesPairConfigDto['instrumentType'],
      symbol: existing.symbol,
      baseAsset: existing.baseAsset,
      quoteAsset: existing.quoteAsset,
      metadata: dto.metadata !== undefined ? dto.metadata : existing.metadata,
    }

    this.assertOkxPairFieldsConsistent(merged)

    const canonicalInstId = this.resolveOkxInstId(merged)

    if (!canonicalInstId) {
      throw new DomainException(
        '无法解析 OKX instId，请检查 symbol/baseAsset/quoteAsset 或在 metadata 中提供 okxInstId/okxContract',
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        },
      )
    }

    // 检查是否与其他配置产生 instId 冲突
    const sameExchangeConfigs = await this.repository.findAll({
      exchange: existing.exchange,
      instrumentType: existing.instrumentType,
    })

    for (const cfg of sameExchangeConfigs) {
      if (cfg.id === id) continue

      const cfgInstId = this.resolveOkxInstId({
        exchange: cfg.exchange,
        instrumentType: cfg.instrumentType as CreateTradesPairConfigDto['instrumentType'],
        symbol: cfg.symbol,
        baseAsset: cfg.baseAsset,
        quoteAsset: cfg.quoteAsset,
        metadata: cfg.metadata ?? undefined,
      })

      if (cfgInstId && cfgInstId === canonicalInstId) {
        throw new DomainException(
          `已经存在使用相同 OKX instId 的订阅配置：instId=${canonicalInstId}（pairId=${cfg.pairId}）`,
          {
            code: ErrorCode.CONFLICT,
            status: HttpStatus.CONFLICT,
          },
        )
      }
    }

    return this.repository.update(id, dto, { canonicalInstId })
  }

  async delete(id: string): Promise<void> {
    // 确保配置存在
    await this.findById(id)
    
    await this.repository.delete(id)
  }

  /**
   * 根据 Trades 配置解析标准化的 OKX instId
   * 需与 OkxTradesWsAdapterBase.resolveInstId 保持语义一致
   */
  private resolveOkxInstId(input: {
    exchange: string
    instrumentType: CreateTradesPairConfigDto['instrumentType']
    symbol: string
    baseAsset: string
    quoteAsset: string
    metadata?: unknown
  }): string | null {
    if (input.exchange.toUpperCase() !== 'OKX') return null

    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : null

    const pickMetadataString = (keys: string[]): string | null => {
      if (!metadata) return null
      for (const key of keys) {
        const value = metadata[key]
        if (typeof value === 'string' && value.trim().length) {
          return value.trim().toUpperCase()
        }
      }
      return null
    }

    const base = input.baseAsset.trim().toUpperCase()
    const quote = input.quoteAsset.trim().toUpperCase()

    const metaInstId = pickMetadataString(['okxInstId', 'instId'])
    if (metaInstId) {
      if (input.instrumentType === 'SPOT') {
        return metaInstId.endsWith('-SWAP') ? null : metaInstId
      }
      if (input.instrumentType === 'PERPETUAL') {
        return metaInstId.endsWith('-SWAP') ? metaInstId : `${base}-${quote}-SWAP`
      }
      return metaInstId
    }

    if (input.instrumentType === 'SPOT') {
      return `${base}-${quote}`
    }

    if (input.instrumentType === 'PERPETUAL') {
      return `${base}-${quote}-SWAP`
    }

    if (input.instrumentType === 'FUTURE') {
      const metaContract = pickMetadataString(['okxContract'])
      if (metaContract) return metaContract
    }

    return null
  }

  private assertOkxPairFieldsConsistent(input: {
    exchange: string
    instrumentType: CreateTradesPairConfigDto['instrumentType']
    symbol: string
    baseAsset: string
    quoteAsset: string
    metadata?: unknown
  }): void {
    if (input.exchange.trim().toUpperCase() !== 'OKX') return

    const base = input.baseAsset.trim().toUpperCase()
    const quote = input.quoteAsset.trim().toUpperCase()
    const symbol = input.symbol.trim().toUpperCase()

    const throwBadRequest = (message: string) => {
      throw new DomainException(message, {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : null

    const metaInstId =
      metadata && typeof metadata.okxInstId === 'string' && metadata.okxInstId.trim().length
        ? metadata.okxInstId.trim().toUpperCase()
        : metadata && typeof metadata.instId === 'string' && metadata.instId.trim().length
          ? metadata.instId.trim().toUpperCase()
          : null

    if (metaInstId && metaInstId.includes('-')) {
      const parts = metaInstId.split('-').filter(Boolean)
      if (parts.length < 2) {
        throwBadRequest(`metadata.instId/okxInstId 格式错误：${metaInstId}`)
      }
      if (parts[0] !== base || parts[1] !== quote) {
        throwBadRequest(
          `metadata.instId/okxInstId 与 baseAsset/quoteAsset 不一致：instId=${metaInstId} baseAsset=${base} quoteAsset=${quote}`,
        )
      }
      if (input.instrumentType === 'SPOT' && metaInstId.endsWith('-SWAP')) {
        throwBadRequest(`SPOT 不允许 metadata.instId/okxInstId 以 -SWAP 结尾：${metaInstId}`)
      }
      if (input.instrumentType === 'PERPETUAL' && !metaInstId.endsWith('-SWAP')) {
        throwBadRequest(`PERPETUAL 要求 metadata.instId/okxInstId 以 -SWAP 结尾：${metaInstId}`)
      }
    }

    // 对 OKX 风格的 symbol（包含 '-'）可以可靠解析 base/quote
    if (symbol.includes('-')) {
      const parts = symbol.split('-').filter(Boolean)
      if (parts.length < 2) {
        throwBadRequest(`symbol 格式错误：${symbol}`)
      }

      if (parts[0] !== base || parts[1] !== quote) {
        throwBadRequest(
          `symbol 与 baseAsset/quoteAsset 不一致：symbol=${symbol} baseAsset=${base} quoteAsset=${quote}`,
        )
      }

      if (input.instrumentType === 'SPOT') {
        if (parts.length !== 2) {
          throwBadRequest(`SPOT symbol 必须为 ${base}-${quote}，实际：${symbol}`)
        }
        if (symbol.endsWith('-SWAP')) {
          throwBadRequest(`SPOT symbol 不能以 -SWAP 结尾，实际：${symbol}`)
        }
      }

      if (input.instrumentType === 'PERPETUAL') {
        // 允许录入 BTC-USDT 或 BTC-USDT-SWAP，但不允许 BTC-USDT-240329 之类的 FUTURE contract 混入
        if (parts.length >= 3 && parts[2] !== 'SWAP') {
          throwBadRequest(`PERPETUAL symbol 应为 ${base}-${quote}-SWAP（或省略 -SWAP），实际：${symbol}`)
        }
      }
    }
    else {
      // 非 OKX 风格（如 BTCUSDT）无法无歧义拆分，但至少约束 base/quote 必须出现在 symbol 中，避免明显错配
      if (!symbol.startsWith(base) || !symbol.includes(quote)) {
        throwBadRequest(
          `symbol 与 baseAsset/quoteAsset 可能不一致：symbol=${symbol} baseAsset=${base} quoteAsset=${quote}`,
        )
      }
    }

    // FUTURE 合约以 metadata.okxContract 为准，补充一次 base/quote 校验，避免合约字段错配
    if (input.instrumentType === 'FUTURE') {
      const okxContract =
        metadata && typeof metadata.okxContract === 'string' && metadata.okxContract.trim().length
          ? metadata.okxContract.trim().toUpperCase()
          : null

      if (okxContract && okxContract.includes('-')) {
        const parts = okxContract.split('-').filter(Boolean)
        if (parts.length >= 2 && (parts[0] !== base || parts[1] !== quote)) {
          throwBadRequest(
            `metadata.okxContract 与 baseAsset/quoteAsset 不一致：okxContract=${okxContract} baseAsset=${base} quoteAsset=${quote}`,
          )
        }
      }
    }
  }
}






