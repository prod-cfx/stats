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

    try {
      return await this.repository.create(dto)
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
    await this.findById(id)
    return this.repository.update(id, dto)
  }

  async delete(id: string): Promise<void> {
    // 确保配置存在
    await this.findById(id)
    
    await this.repository.delete(id)
  }
}
