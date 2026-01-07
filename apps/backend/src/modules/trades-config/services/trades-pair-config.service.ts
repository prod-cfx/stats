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

    const metaInstId = pickMetadataString(['okxInstId', 'instId', 'symbol'])
    if (metaInstId) return metaInstId

    const symbol = input.symbol.toUpperCase()
    if (symbol.includes('-')) return symbol

    const base = input.baseAsset.toUpperCase()
    const quote = input.quoteAsset.toUpperCase()

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
}
