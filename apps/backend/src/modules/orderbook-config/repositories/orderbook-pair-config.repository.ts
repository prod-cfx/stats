// Nest 注入需要运行时引用 PrismaService，保留值导入
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { CreateOrderbookPairConfigDto } from '../dto/create-orderbook-pair-config.dto'
import type { QueryOrderbookPairConfigDto } from '../dto/query-orderbook-pair-config.dto'
import type { UpdateOrderbookPairConfigDto } from '../dto/update-orderbook-pair-config.dto'
import type { OrderbookPairConfig } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class OrderbookPairConfigRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findAll(filter?: QueryOrderbookPairConfigDto): Promise<OrderbookPairConfig[]> {

    const where: any = {}

    if (filter?.venue) {
      where.venue = filter.venue
    }

    if (filter?.venueType) {
      where.venueType = filter.venueType
    }

    if (filter?.instrumentType) {
      where.instrumentType = filter.instrumentType
    }

    if (filter?.enabledOnly) {
      where.enabled = true
    }

    return this.txHost.tx.orderbookPairConfig.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async findById(id: string): Promise<OrderbookPairConfig | null> {
    return this.txHost.tx.orderbookPairConfig.findUnique({
      where: { id },
    })
  }

  async findByPairId(pairId: string): Promise<OrderbookPairConfig | null> {
    return this.txHost.tx.orderbookPairConfig.findUnique({
      where: { pairId },
    })
  }

  async create(dto: CreateOrderbookPairConfigDto): Promise<OrderbookPairConfig> {
    
    return this.txHost.tx.orderbookPairConfig.create({
      data: {
        pairId: dto.pairId,
        venue: dto.venue,
        symbol: dto.symbol,
        baseAsset: dto.baseAsset,
        quoteAsset: dto.quoteAsset,
        venueType: dto.venueType,
        instrumentType: dto.instrumentType,
        enabled: dto.enabled ?? true,
        pullIntervalSeconds: dto.pullIntervalSeconds ?? null,
        depthLevels: dto.depthLevels ?? null,
        priority: dto.priority ?? 100,
        metadata: dto.metadata ?? null,
        description: dto.description ?? null,
      },
    })
  }

  async update(id: string, dto: UpdateOrderbookPairConfigDto): Promise<OrderbookPairConfig> {
    const data: any = {}

    if (dto.enabled !== undefined) data.enabled = dto.enabled
    if (dto.pullIntervalSeconds !== undefined) data.pullIntervalSeconds = dto.pullIntervalSeconds
    if (dto.depthLevels !== undefined) data.depthLevels = dto.depthLevels
    if (dto.priority !== undefined) data.priority = dto.priority
    if (dto.metadata !== undefined) data.metadata = dto.metadata
    if (dto.description !== undefined) data.description = dto.description

    return this.txHost.tx.orderbookPairConfig.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.orderbookPairConfig.delete({
      where: { id },
    })
  }

  async findEnabledConfigs(): Promise<OrderbookPairConfig[]> {
    return this.txHost.tx.orderbookPairConfig.findMany({
      where: { enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  }
}

