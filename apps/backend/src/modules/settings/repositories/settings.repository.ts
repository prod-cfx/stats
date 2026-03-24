// Nest 注入需要运行时引用 PrismaService，保留值导入
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { SystemSetting } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'

@Injectable()
export class SettingsRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}
  async findAll(): Promise<SystemSetting[]> {
    if (defaultEnvAccessor.bool('USE_MOCK_DATA')) {
      return this.generateMockSettings()
    }
    try {
      return await this.txHost.tx.systemSetting.findMany({
        orderBy: { category: 'asc' },
      })
    } catch (error) {
      console.error('Database error in findAll settings, falling back to mock data', error)
      return this.generateMockSettings()
    }
  }

  private generateMockSettings(): SystemSetting[] {
    const now = new Date()
    return [
      {
        id: '1',
        key: 'app.name',
        value: 'Coinflux Mock',
        type: 'string',
        category: 'general',
        description: 'Application Name',
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '2',
        key: 'market.pairs',
        value: '["BTCUSDT", "ETHUSDT"]',
        type: 'json',
        category: 'market',
        description: 'Available market pairs',
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      }
    ]
  }

  async findByKey(key: string): Promise<SystemSetting | null> {
    if (defaultEnvAccessor.bool('USE_MOCK_DATA')) {
      return this.generateMockSettings().find(s => s.key === key) || null
    }
    try {
      return await this.txHost.tx.systemSetting.findUnique({
        where: { key },
      })
    } catch (error) {
      console.error('Database error in findByKey setting, falling back to mock data', error)
      return this.generateMockSettings().find(s => s.key === key) || null
    }
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

