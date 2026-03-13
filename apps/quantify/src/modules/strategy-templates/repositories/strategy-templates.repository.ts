import type { Prisma, StrategyTemplate } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

interface ListParams {
  skip: number
  take: number
  where: Prisma.StrategyTemplateWhereInput
  orderBy?: Prisma.StrategyTemplateOrderByWithRelationInput
}

@Injectable()
export class StrategyTemplatesRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private get client() {
    return this.prisma.getClient()
  }

  async findById(id: string): Promise<StrategyTemplate | null> {
    return this.client.strategyTemplate.findUnique({
      where: { id },
    })
  }

  async findByName(name: string): Promise<StrategyTemplate | null> {
    return this.client.strategyTemplate.findUnique({
      where: { name },
    })
  }

  async paginate(params: ListParams): Promise<[StrategyTemplate[], number]> {
    const delegate = this.client.strategyTemplate
    return this.prisma.getPaginatedList(
      delegate as any,
      {
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
      },
      { skip: params.skip, take: params.take },
    )
  }

  async create(data: Prisma.StrategyTemplateCreateInput): Promise<StrategyTemplate> {
    return this.client.strategyTemplate.create({ data })
  }

  async update(id: string, data: Prisma.StrategyTemplateUpdateInput): Promise<StrategyTemplate> {
    return this.client.strategyTemplate.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<StrategyTemplate> {
    return this.client.strategyTemplate.delete({
      where: { id },
    })
  }
}
