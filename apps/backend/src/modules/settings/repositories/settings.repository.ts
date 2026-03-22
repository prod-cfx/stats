import type { SystemSetting } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
// Nest 注入需要运行时引用 PrismaService，保留值导入
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SettingsRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findAll(): Promise<SystemSetting[]> {
    if (defaultEnvAccessor.bool('USE_MOCK_DATA')) {
      return this.generateMockSettings()
    }
    try {
      const client = this.getClient()
      return await client.systemSetting.findMany({
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
      const client = this.getClient()
      return await client.systemSetting.findUnique({
        where: { key },
      })
    } catch (error) {
      console.error('Database error in findByKey setting, falling back to mock data', error)
      return this.generateMockSettings().find(s => s.key === key) || null
    }
  }

  async findByCategory(category: string): Promise<SystemSetting[]> {
    const client = this.getClient()
    return client.systemSetting.findMany({
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
    const client = this.getClient()
    return client.systemSetting.create({
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
    const client = this.getClient()
    return client.systemSetting.update({
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
    const client = this.getClient()
    return client.systemSetting.upsert({
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
    const client = this.getClient()
    return client.systemSetting.delete({
      where: { key },
    })
  }
}

