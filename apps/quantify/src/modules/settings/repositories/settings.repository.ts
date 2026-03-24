import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, SystemSetting } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SettingsRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private readonly prisma: PrismaService,
  ) {}

  private isMissingClsContextError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }
    return /cls/i.test(error.message) && /context|store|active/i.test(error.message)
  }

  private get db(): Pick<PrismaClient, 'systemSetting'> {
    try {
      if (this.txHost.isTransactionActive()) {
        return this.txHost.tx
      }
    }
    catch (error) {
      // Startup hooks may run without CLS context; fallback to plain Prisma client only for that case.
      if (this.isMissingClsContextError(error)) {
        return this.prisma
      }
      throw error
    }
    return this.prisma
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.db.systemSetting.findMany({
      orderBy: { category: 'asc' },
    })
  }

  async findByKey(key: string): Promise<SystemSetting | null> {
    return this.db.systemSetting.findUnique({
      where: { key },
    })
  }

  async findByCategory(category: string): Promise<SystemSetting[]> {
    return this.db.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    })
  }

  async create(data: {
    key: string
    value: string
    type?: string
    description?: string
    category?: string
    isSystem?: boolean
  }): Promise<SystemSetting> {
    return this.db.systemSetting.create({
      data,
    })
  }

  async update(
    key: string,
    data: {
      value?: string
      type?: string
      description?: string
      category?: string
      isSystem?: boolean
    },
  ): Promise<SystemSetting> {
    return this.db.systemSetting.update({
      where: { key },
      data,
    })
  }

  async upsert(data: {
    key: string
    value: string
    type?: string
    description?: string
    category?: string
    isSystem?: boolean
  }): Promise<SystemSetting> {
    return this.db.systemSetting.upsert({
      where: { key: data.key },
      update: {
        value: data.value,
        type: data.type,
        description: data.description,
        category: data.category,
        isSystem: data.isSystem,
        updatedAt: new Date(),
      },
      create: data,
    })
  }

  async delete(key: string): Promise<SystemSetting> {
    return this.db.systemSetting.delete({
      where: { key },
    })
  }
}
