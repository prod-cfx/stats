import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, SystemSetting } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SettingsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.txHost.tx.systemSetting.findMany({
      orderBy: { category: 'asc' },
    })
  }

  async findByKey(key: string): Promise<SystemSetting | null> {
    return this.txHost.tx.systemSetting.findUnique({
      where: { key },
    })
  }

  async findByCategory(category: string): Promise<SystemSetting[]> {
    return this.txHost.tx.systemSetting.findMany({
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
    return this.txHost.tx.systemSetting.create({
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
    return this.txHost.tx.systemSetting.update({
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
    return this.txHost.tx.systemSetting.upsert({
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
    return this.txHost.tx.systemSetting.delete({
      where: { key },
    })
  }
}
