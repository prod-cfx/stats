import type { INestApplication, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { ClsService } from 'nestjs-cls'
import type { EnvService } from '../common/services/env.service'
import type { PrismaModuleOptions } from './prisma.constants'
import { generateShortId } from '@ai/shared'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService as ConfigServiceToken } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { ClsService as ClsServiceToken } from 'nestjs-cls'
import { PrismaClient as PrismaClientBase } from '@/prisma/prisma.types'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { EnvService as EnvServiceToken } from '../common/services/env.service'
import { PRISMA_OPTIONS } from './prisma.constants'

const TRANSACTION_KEY = 'PRISMA_TRANSACTION'

// 使用 any 以避免对生成的 Prisma Client 类型的直接依赖
type ExtendedPrismaClient = any
type TransactionClient = any

interface PrismaLogDefinition {
  emit: 'event' | 'stdout'
  level: 'query' | 'info' | 'warn' | 'error'
}

const MODELS_NEEDING_SHORT_ID: readonly string[] = []

@Injectable()
export class PrismaService extends (PrismaClientBase as any) implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private extendedClient: ExtendedPrismaClient | null = null
  private static readonly MODEL_DELEGATES = [] as const

  constructor(
    @Inject(ClsServiceToken) private readonly cls: ClsService,
    @Inject(ConfigServiceToken) private readonly configService: ConfigService,
    @Inject(EnvServiceToken) private readonly envService: EnvService,
    @Optional() @Inject(PRISMA_OPTIONS) private readonly options?: PrismaModuleOptions,
  ) {
    // 使用静态 defaultEnvAccessor（因为 super() 必须在访问 this 之前调用）
    const appEnv = defaultEnvAccessor.appEnv()
    const isTestOrE2E = appEnv === 'test' || appEnv === 'e2e'
    const isProd = appEnv === 'production'

    // SKIP_PRISMA_CONNECT: 用于 Swagger/Contracts 生成等离线场景，跳过数据库连接
    // USE_MOCK_DATA: 本地/演示模式下允许无数据库启动（仓库层会自行回退到 mock）
    const skipConnect =
      defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false) ||
      defaultEnvAccessor.bool('USE_MOCK_DATA', false)

    const logConfig: PrismaLogDefinition[] = [
      // query 事件统一通过 setupQueryLogging 走 Nest Logger
      { emit: 'event', level: 'query' },
    ]

    // 在开发/生产环境保留 Prisma 自带的 stdout 日志，在测试/E2E 中关闭，避免噪音
    if (!isTestOrE2E) {
      logConfig.push(
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      )
    }

    // Prisma 7: 使用 Driver Adapter 连接 PostgreSQL
    // 由于 Prisma 7 driverAdapters 特性要求构造时必须提供 adapter，
    // 即使在 SKIP_PRISMA_CONNECT 模式下也需要创建 adapter（使用空连接字符串）
    // 注意: super() 必须在构造函数顶层调用，因此先计算 adapter
    let connectionString = ''
    if (!skipConnect) {
      const dbUrl = defaultEnvAccessor.str('DATABASE_URL')
      const isPlaceholder = !dbUrl || dbUrl === '__SET_IN_env.local__'
      if (isPlaceholder) {
        // 非生产环境：允许无数据库启动（自动进入 mock/offline 模式）
        if (!isProd && !isTestOrE2E) {
          process.env.USE_MOCK_DATA = 'true'
          connectionString = ''
        } else {
          throw new Error(
            'DATABASE_URL 未配置或仍为占位符。请在 .env.*.local 中设置有效的数据库连接字符串。',
          )
        }
      } else {
        connectionString = dbUrl
      }
    }
    const adapter = new PrismaPg({ connectionString })

    super({
      adapter,
      log: logConfig,
    })
  }

  async onModuleInit() {
    // SKIP_PRISMA_CONNECT: 用于 Swagger/Contracts 生成等离线场景，跳过数据库连接
    if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false) || defaultEnvAccessor.bool('USE_MOCK_DATA', false)) {
      this.logger.log('SKIP_PRISMA_CONNECT or USE_MOCK_DATA is true, skipping database connection')
      this.applyShortIdExtension()
      return
    }

    try {
      await this.$connect()
    } catch (error) {
      const appEnv = defaultEnvAccessor.appEnv()
      const isTestOrE2E = appEnv === 'test' || appEnv === 'e2e'
      const isProd = appEnv === 'production'
      const allowFallback = !isProd && !isTestOrE2E

      const dbUrl = this.envService.getString('DATABASE_URL') || ''
      let masked = '(未设置)'
      if (dbUrl) {
        masked = dbUrl
        try {
          const parsed = new URL(dbUrl)
          if (parsed.password) parsed.password = '****'
          masked = parsed.toString()
        } catch {
          masked = dbUrl.replace(/(:)([^:@/]+)(@)/, '$1****$3')
        }
      }
      this.logger.error(
        `数据库连接失败：无法连接到 Postgres。\n` +
          `- DATABASE_URL: ${masked}\n` +
          `- 请检查数据库服务是否已启动、地址/端口/数据库名/用户名/密码是否正确。\n` +
          `- 如在本地，请确认 Docker/Postgres 是否在运行；如在云端，请检查网络与安全组。\n` +
          `原始错误：${(error as Error)?.message}`,
      )
      if (allowFallback) {
        // 非生产环境：不阻塞启动，让上层 Repository 自行兜底到 mock
        process.env.USE_MOCK_DATA = 'true'
        this.logger.warn('Non-prod DB connection failed; falling back to USE_MOCK_DATA=true for this run.')
      } else {
        throw error
      }
    }

    this.applyShortIdExtension()
    this.setupQueryLogging()
  }

  async onModuleDestroy() {
    // SKIP_PRISMA_CONNECT/USE_MOCK_DATA: 离线/Mock 模式下跳过 Prisma 断开
    if (
      defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false) ||
      defaultEnvAccessor.bool('USE_MOCK_DATA', false)
    ) {
      this.logger.log('SKIP_PRISMA_CONNECT or USE_MOCK_DATA is true, skipping database disconnect')
      return
    }

    this.logger.log('Disconnecting from database...')
    await this.$disconnect()
    this.logger.log('Database disconnected successfully')
  }

  private applyShortIdExtension() {
    // 当 MODELS_NEEDING_SHORT_ID 为空时，直接返回原始客户端
    if (MODELS_NEEDING_SHORT_ID.length === 0) {
      this.extendedClient = this as unknown as ExtendedPrismaClient
      this.rebindExtendedDelegates()
      return
    }

    // 使用类型断言绕过 Prisma 类型系统的限制
    this.extendedClient = (this.$extends as any)({
      query: {
        $allModels: {
          async create({ model, args, query }: any) {
            if (MODELS_NEEDING_SHORT_ID.includes(model)) {
              const data = args.data as Record<string, unknown>
              if (!data.id) {
                data.id = generateShortId()
              }
            }
            return query(args)
          },
          async createMany({ model, args, query }: any) {
            if (MODELS_NEEDING_SHORT_ID.includes(model) && Array.isArray(args.data)) {
              args.data.forEach(item => {
                const candidate = item as Record<string, unknown>
                if (!candidate.id) {
                  candidate.id = generateShortId()
                }
              })
            }
            return query(args)
          },
          async upsert({ model, args, query }: any) {
            if (MODELS_NEEDING_SHORT_ID.includes(model)) {
              const create = args.create as Record<string, unknown> | undefined
              if (create && !create.id) {
                create.id = generateShortId()
              }
            }
            return query(args)
          },
        },
      },
    }) as unknown as ExtendedPrismaClient

    this.rebindExtendedDelegates()
  }

  private rebindExtendedDelegates() {
    if (!this.extendedClient) return

    // 当 MODEL_DELEGATES 为空时，无需重新绑定
    if (PrismaService.MODEL_DELEGATES.length === 0) return

    for (const key of PrismaService.MODEL_DELEGATES) {
      if ((this.extendedClient as any)[key]) {
        ;(this as any)[key] = (this.extendedClient as any)[key]
      }
    }

    if (typeof (this.extendedClient as any).$transaction === 'function') {
      ;(this as any).$transaction = (this.extendedClient as any).$transaction.bind(this.extendedClient)
    }
  }

  private setupQueryLogging() {
    const attach = (client: any) => {
      const anyClient = client as any
      if (typeof anyClient.$on !== 'function') return
      anyClient.$on('query', (event: any) => {
        const duration = event.duration as number
        const sql = event.query as string
        const safeSql = this.sanitizeSql(sql)
        const slowMs = this.configService.get<number>('prisma.slowQueryMs', 100)
        const criticalMs = this.configService.get<number>('prisma.criticalSlowQueryMs', 500)
        const isSlowQuery = duration > slowMs
        const isCriticalSlowQuery = duration > criticalMs
        const isOrchestrationQuery = this.isOrchestrationRelatedQuery(sql)
        const inDevDebug = this.envService.isDev() || this.envService.isDebugMode()
        const summary = `${duration}ms - ${safeSql.substring(0, 120)}...`

        if (isCriticalSlowQuery) {
          this.logger.error(`🚨 严重慢查询警告: ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (isSlowQuery) {
          this.logger.warn(`⚠️ 慢查询警告: ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (inDevDebug && isOrchestrationQuery) {
          this.logger.debug(`📊 编排查询: ${summary}`)
        }
      })
    }

    attach(this)
    if (this.extendedClient) attach(this.extendedClient)
    this.logger.log('查询性能监控已启用')
  }

  private sanitizeSql(sql: string): string {
    return sql
      .replace(/(password\s*=\s*)'[^']*'/gi, "$1'***'")
      .replace(/(email\s*=\s*)'[^']*'/gi, "$1'***'")
  }

  private isOrchestrationRelatedQuery(query: string): boolean {
    const orchestrationTables = this.options?.monitoredTables ?? []
    if (orchestrationTables.length === 0) return false
    const lowerQuery = query.toLowerCase()
    return orchestrationTables.some(table => {
      const t = table.toLowerCase()
      return (
        lowerQuery.includes(`from "${t}"`) ||
        lowerQuery.includes(`from \`${t}\``) ||
        lowerQuery.includes(`update "${t}"`) ||
        lowerQuery.includes(`update \`${t}\``) ||
        lowerQuery.includes(` ${t} `)
      )
    })
  }

  async enableShutdownHooks(app: INestApplication) {
    ;(this as any).$on('beforeExit' as never, async () => {
      await app.close()
    })
  }

  getClient(): ExtendedPrismaClient | TransactionClient {
    const tx = this.cls.get(TRANSACTION_KEY) as TransactionClient | undefined
    return tx || this.extendedClient || (this as unknown as ExtendedPrismaClient)
  }

  async runInTransaction<T>(
    fn: (prisma: TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
    },
  ): Promise<T> {
    const txId = Math.random().toString(36).substring(2, 8)
    const existingTx = this.cls.get(TRANSACTION_KEY) as TransactionClient | undefined

    if (existingTx) {
      try {
        return await fn(existingTx)
      } catch (error) {
        this.logger.error(`[TX:${txId}] 在现有事务中执行失败: ${(error as Error).message}`)
        throw error
      }
    }

    const baseClient = (this.extendedClient || this) as ExtendedPrismaClient
    const defaultTestOptions =
      this.envService.isTest() || this.envService.isE2E()
        ? { maxWait: 10_000, timeout: 20_000 }
        : undefined
    const txOptions = { ...(defaultTestOptions || {}), ...(options || {}) }

    return baseClient.$transaction(async tx => {
      this.cls.set(TRANSACTION_KEY, tx)
      try {
        return await fn(tx)
      } catch (error) {
        this.logger.error(`[TX:${txId}] 新事务执行失败: ${(error as Error).message}`)
        throw error
      } finally {
        this.cls.set(TRANSACTION_KEY, null)
      }
    }, txOptions)
  }

  async getPaginatedList<
    M,
    W extends Record<string, unknown>,
    A extends { where?: W; orderBy?: unknown; select?: unknown; include?: unknown }
  >(
    delegate: {
      findMany: (args: A & { skip: number; take: number }) => Promise<M[]>
      count: (args: { where?: W }) => Promise<number>
    },
    queryOptions: A,
    pagination: { skip: number; take: number },
  ): Promise<[M[], number]> {
    const [items, total] = await Promise.all([
      delegate.findMany({ ...queryOptions, ...pagination }),
      delegate.count({ where: queryOptions.where }),
    ])
    return [items, total]
  }
}
