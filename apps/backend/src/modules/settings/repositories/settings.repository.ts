// Nest 注入需要运行时引用 PrismaService，保留值导入
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { SystemSetting } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { DomainException } from '@/common/exceptions/domain.exception'

@Injectable()
export class SettingsRepository {
  private readonly logger = new Logger(SettingsRepository.name)

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
      this.logDatabaseError('findAll', {}, error)
      throw new DomainException('settings.database_error', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { detail: 'DatabaseError' },
      })
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
      this.logDatabaseError('findByKey', { key }, error)
      throw new DomainException('settings.database_error', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { detail: 'DatabaseError' },
      })
    }
  }

  private logDatabaseError(method: string, payload: Record<string, unknown>, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    this.logger.error(
      `Database error in ${method}: ${JSON.stringify({ ...payload, errorMessage })}`,
      stack,
    )
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
