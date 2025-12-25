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

  async findAll(filter?: QueryExchangeConfigDto): Promise<ExchangeConfig[]> {
    const client = this.getClient()
    const where: PrismaTypes.ExchangeConfigWhereInput = {}

    if (filter?.code) {
      where.code = filter.code
    }

    if (filter?.venueType) {
      where.venueType = filter.venueType
    }

    if (filter?.enabledOnly) {
      where.enabled = true
    }

    if (filter?.name) {
      where.name = { contains: filter.name, mode: 'insensitive' }
    }

    return client.exchangeConfig.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    })
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

