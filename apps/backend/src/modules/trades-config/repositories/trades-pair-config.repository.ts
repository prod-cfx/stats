// Nest 注入需要运行时引用 PrismaService，保留值导入
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { CreateTradesPairConfigDto } from '../dto/create-trades-pair-config.dto'
import type { QueryTradesPairConfigDto } from '../dto/query-trades-pair-config.dto'
import type { UpdateTradesPairConfigDto } from '../dto/update-trades-pair-config.dto'
import type { TradesPairConfig } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class TradesPairConfigRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findAll(filter?: QueryTradesPairConfigDto): Promise<TradesPairConfig[]> {

    const where: any = {}

    if (filter?.exchange) {
      where.exchange = filter.exchange
    }

    if (filter?.instrumentType) {
      where.instrumentType = filter.instrumentType
    }

    if (filter?.enabledOnly) {
      where.enabled = true
    }

    return this.txHost.tx.tradesPairConfig.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async findById(id: string): Promise<TradesPairConfig | null> {
    return this.txHost.tx.tradesPairConfig.findUnique({
      where: { id },
    })
  }

  async findByPairId(pairId: string): Promise<TradesPairConfig | null> {
    return this.txHost.tx.tradesPairConfig.findUnique({
      where: { pairId },
    })
  }

  async create(dto: CreateTradesPairConfigDto, canonicalInstId: string | null): Promise<TradesPairConfig> {

    const normalize = (value: string) => value.trim().toUpperCase()

    return this.txHost.tx.tradesPairConfig.create({
      data: {
        pairId: dto.pairId,
        exchange: normalize(dto.exchange),
        symbol: normalize(dto.symbol),
        baseAsset: normalize(dto.baseAsset),
        quoteAsset: normalize(dto.quoteAsset),
        instrumentType: normalize(dto.instrumentType),
        canonicalInstId,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 100,
        metadata: dto.metadata ?? null,
        description: dto.description ?? null,
      },
    })
  }

  async update(
    id: string,
    dto: UpdateTradesPairConfigDto,
    options?: { canonicalInstId?: string | null },
  ): Promise<TradesPairConfig> {
    const data: any = {}

    if (dto.enabled !== undefined) data.enabled = dto.enabled
    if (dto.priority !== undefined) data.priority = dto.priority
    if (dto.metadata !== undefined) data.metadata = dto.metadata
    if (dto.description !== undefined) data.description = dto.description
    if (options && 'canonicalInstId' in options) data.canonicalInstId = options.canonicalInstId

    return this.txHost.tx.tradesPairConfig.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.tradesPairConfig.delete({
      where: { id },
    })
  }

  async findEnabledConfigs(): Promise<TradesPairConfig[]> {
    return this.txHost.tx.tradesPairConfig.findMany({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  }
}







