import type { ExchangeConfig, Prisma as PrismaTypes } from '@prisma/client'
import type { CreateExchangeConfigDto } from '../dto/create-exchange-config.dto'
import type { QueryExchangeConfigDto } from '../dto/query-exchange-config.dto'
import type { UpdateExchangeConfigDto } from '../dto/update-exchange-config.dto'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class ExchangeConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async list(params: QueryExchangeConfigDto): Promise<{ total: number; items: ExchangeConfig[] }> {
    const client = this.getClient()
    const where: PrismaTypes.ExchangeConfigWhereInput = {}

    if (params.code) {
      where.code = params.code
    }

    if (params.venueType) {
      where.venueType = params.venueType
    }

    if (typeof params.enabled === 'boolean') {
      where.enabled = params.enabled
    }

    if (params.name) {
      where.name = { contains: params.name, mode: 'insensitive' }
    }

    const page = params.page ?? 1
    const limit = params.limit ?? 20

    const [total, items] = await client.$transaction([
      client.exchangeConfig.count({ where }),
      client.exchangeConfig.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return { total, items }
  }

  async findById(id: string): Promise<ExchangeConfig | null> {
    const client = this.getClient()
    return client.exchangeConfig.findUnique({ where: { id } })
  }

  async findByCode(code: string): Promise<ExchangeConfig | null> {
    const client = this.getClient()
    return client.exchangeConfig.findUnique({ where: { code } })
  }

  async create(dto: CreateExchangeConfigDto): Promise<ExchangeConfig> {
    const client = this.getClient()
    const data: PrismaTypes.ExchangeConfigCreateInput = {
      code: dto.code,
      name: dto.name,
      avatarUrl: dto.avatarUrl ?? null,
      intro: dto.intro ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      venueType: dto.venueType ?? null,
      enabled: dto.enabled ?? true,
      sort: dto.sort ?? 100,
    }

    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata === null
        ? Prisma.DbNull
        : (dto.metadata as unknown as PrismaTypes.InputJsonValue)
    }

    return client.exchangeConfig.create({
      data,
    })
  }

  async update(id: string, dto: UpdateExchangeConfigDto): Promise<ExchangeConfig> {
    const client = this.getClient()
    const data: PrismaTypes.ExchangeConfigUpdateInput = {}

    if (dto.code !== undefined) data.code = dto.code
    if (dto.name !== undefined) data.name = dto.name
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl
    if (dto.intro !== undefined) data.intro = dto.intro
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl
    if (dto.venueType !== undefined) data.venueType = dto.venueType
    if (dto.enabled !== undefined) data.enabled = dto.enabled
    if (dto.sort !== undefined) data.sort = dto.sort
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata === null
        ? Prisma.DbNull
        : (dto.metadata as unknown as PrismaTypes.InputJsonValue)
    }

    return client.exchangeConfig.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    const client = this.getClient()
    await client.exchangeConfig.delete({ where: { id } })
  }
}

