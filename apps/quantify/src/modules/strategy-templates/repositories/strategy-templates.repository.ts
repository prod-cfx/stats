import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, Prisma, StrategyTemplate } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

interface ListParams {
  skip: number
  take: number
  where: Prisma.StrategyTemplateWhereInput
  orderBy?: Prisma.StrategyTemplateOrderByWithRelationInput
}

@Injectable()
export class StrategyTemplatesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findById(id: string): Promise<StrategyTemplate | null> {
    return this.txHost.tx.strategyTemplate.findUnique({
      where: { id },
    })
  }

  async findByName(name: string): Promise<StrategyTemplate | null> {
    return this.txHost.tx.strategyTemplate.findUnique({
      where: { name },
    })
  }

  async paginate(params: ListParams): Promise<[StrategyTemplate[], number]> {
    const orderBy = params.orderBy ?? { createdAt: 'desc' }
    const [items, total] = await Promise.all([
      this.txHost.tx.strategyTemplate.findMany({
        where: params.where,
        orderBy,
        skip: params.skip,
        take: params.take,
      }),
      this.txHost.tx.strategyTemplate.count({ where: params.where }),
    ])
    return [items, total]
  }

  async create(data: Prisma.StrategyTemplateCreateInput): Promise<StrategyTemplate> {
    return this.txHost.tx.strategyTemplate.create({ data })
  }

  async update(id: string, data: Prisma.StrategyTemplateUpdateInput): Promise<StrategyTemplate> {
    return this.txHost.tx.strategyTemplate.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<StrategyTemplate> {
    return this.txHost.tx.strategyTemplate.delete({
      where: { id },
    })
  }

  async findSymbolsByCodes(codes: string[]) {
    return this.txHost.tx.symbol.findMany({
      where: { code: { in: codes } },
      select: { code: true, status: true },
    })
  }
}
