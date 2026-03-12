import type { INestApplication, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { Prisma } from '@prisma/client'
import type { ClsService } from 'nestjs-cls'
import type { Pool as PgPool } from 'pg'
import type { EnvService } from '../common/services/env.service'
import type { PrismaModuleOptions } from './prisma.constants'
import { generateShortId } from '@ai/shared'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService as ConfigServiceToken } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { ClsService as ClsServiceToken } from 'nestjs-cls'
import { Pool } from 'pg'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { EnvService as EnvServiceToken } from '../common/services/env.service'
import { PRISMA_OPTIONS } from './prisma.constants'

const TRANSACTION_KEY = 'PRISMA_TRANSACTION'

type ExtendedPrismaClient = PrismaClient

const MODELS_NEEDING_SHORT_ID: readonly string[] = []

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private extendedClient: ExtendedPrismaClient | null = null
  private static readonly MODEL_DELEGATES = [] as const
  // Prisma 7: 杩炴帴姹犵敱 pg 绠＄悊
  private pool: PgPool | null = null

  constructor(
    @Inject(ClsServiceToken) private readonly cls: ClsService,
    @Inject(ConfigServiceToken) private readonly configService: ConfigService,
    @Inject(EnvServiceToken) private readonly envService: EnvService,
    @Optional() @Inject(PRISMA_OPTIONS) private readonly options?: PrismaModuleOptions,
  ) {
    // 浣跨敤闈欐€?defaultEnvAccessor锛堝洜涓?super() 蹇呴』鍦ㄨ闂?this 涔嬪墠璋冪敤锛?
    const appEnv = defaultEnvAccessor.appEnv()
    const isTestOrE2E = appEnv === 'test' || appEnv === 'e2e'

    // SKIP_PRISMA_CONNECT: 鐢ㄤ簬 Swagger/Contracts 鐢熸垚绛夌绾垮満鏅紝璺宠繃鏁版嵁搴撹繛鎺?
    const skipConnect = defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)

    const logConfig: Prisma.LogDefinition[] = [
      // query 浜嬩欢缁熶竴閫氳繃 setupQueryLogging 璧?Nest Logger
      { emit: 'event', level: 'query' },
    ]

    // 鍦ㄥ紑鍙?鐢熶骇鐜淇濈暀 Prisma 鑷甫鐨?stdout 鏃ュ織锛屽湪娴嬭瘯/E2E 涓叧闂紝閬垮厤鍣煶
    if (!isTestOrE2E) {
      logConfig.push(
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      )
    }

    // Prisma 7: 浣跨敤 Driver Adapter 杩炴帴 PostgreSQL
    // 鐢变簬 Prisma 7 driverAdapters 鐗规€ц姹傛瀯閫犳椂蹇呴』鎻愪緵 adapter锛?
    // 鍗充娇鍦?SKIP_PRISMA_CONNECT 妯″紡涓嬩篃闇€瑕佸垱寤?adapter锛堜娇鐢ㄧ┖杩炴帴瀛楃涓诧級
    // 娉ㄦ剰: super() 蹇呴』鍦ㄦ瀯閫犲嚱鏁伴《灞傝皟鐢紝鍥犳鍏堣绠?adapter
    let connectionString = ''
    if (!skipConnect) {
      const dbUrl = defaultEnvAccessor.str('DATABASE_URL')
      if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
        throw new Error(
          'DATABASE_URL 鏈厤缃垨浠嶄负鍗犱綅绗︺€傝鍦?.env.*.local 涓缃湁鏁堢殑鏁版嵁搴撹繛鎺ュ瓧绗︿覆銆?,
        )
      }
      connectionString = dbUrl
    }
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)

    super({
      adapter,
      log: logConfig,
    })

    // 淇濆瓨杩炴帴姹犲紩鐢ㄤ互渚垮湪閿€姣佹椂鍏抽棴
    this.pool = pool
  }

  async onModuleInit() {
    // SKIP_PRISMA_CONNECT: 鐢ㄤ簬 Swagger/Contracts 鐢熸垚绛夌绾垮満鏅紝璺宠繃鏁版嵁搴撹繛鎺?
    if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) {
      this.logger.log('SKIP_PRISMA_CONNECT=true, skipping database connection')
      this.applyShortIdExtension()
      return
    }

    try {
      await this.$connect()
    } catch (error) {
      const dbUrl = this.envService.getString('DATABASE_URL') || ''
      let masked = '(鏈缃?'
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
        `鏁版嵁搴撹繛鎺ュけ璐ワ細鏃犳硶杩炴帴鍒?Postgres銆俓n` +
          `- DATABASE_URL: ${masked}\n` +
          `- 璇锋鏌ユ暟鎹簱鏈嶅姟鏄惁宸插惎鍔ㄣ€佸湴鍧€/绔彛/鏁版嵁搴撳悕/鐢ㄦ埛鍚?瀵嗙爜鏄惁姝ｇ‘銆俓n` +
          `- 濡傚湪鏈湴锛岃纭 Docker/Postgres 鏄惁鍦ㄨ繍琛岋紱濡傚湪浜戠锛岃妫€鏌ョ綉缁滀笌瀹夊叏缁勩€俓n` +
          `鍘熷閿欒锛?{(error as Error)?.message}`,
      )
      throw error
    }

    this.applyShortIdExtension()
    this.setupQueryLogging()
  }

  async onModuleDestroy() {
    // SKIP_PRISMA_CONNECT: 绂荤嚎妯″紡涓嬭烦杩?Prisma 鏂紑锛屼絾浠嶉渶娓呯悊 pool
    if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) {
      this.logger.log('SKIP_PRISMA_CONNECT=true, skipping database disconnect')
      // 浠嶇劧灏濊瘯鍏抽棴 pool锛堝嵆浣挎槸绌鸿繛鎺ュ瓧绗︿覆鍒涘缓鐨勶級
      if (this.pool) {
        try {
          await this.pool.end()
        } catch {
          // 蹇界暐绌鸿繛鎺ユ睜鍏抽棴鏃剁殑閿欒
        }
      }
      return
    }

    this.logger.log('Disconnecting from database...')
    await this.$disconnect()
    // Prisma 7: 鍏抽棴 pg 杩炴帴姹?
    if (this.pool) {
      await this.pool.end()
      this.logger.log('PostgreSQL connection pool closed')
    }
    this.logger.log('Database disconnected successfully')
  }

  private applyShortIdExtension() {
    // 褰?MODELS_NEEDING_SHORT_ID 涓虹┖鏃讹紝鐩存帴杩斿洖鍘熷瀹㈡埛绔?
    if (MODELS_NEEDING_SHORT_ID.length === 0) {
      this.extendedClient = this as unknown as ExtendedPrismaClient
      this.rebindExtendedDelegates()
      return
    }

    // 浣跨敤绫诲瀷鏂█缁曡繃 Prisma 绫诲瀷绯荤粺鐨勯檺鍒?
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
    }) as unknown as PrismaClient

    this.rebindExtendedDelegates()
  }

  private rebindExtendedDelegates() {
    if (!this.extendedClient) return

    // 褰?MODEL_DELEGATES 涓虹┖鏃讹紝鏃犻渶閲嶆柊缁戝畾
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
    const attach = (client: PrismaClient) => {
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
          this.logger.error(`馃毃 涓ラ噸鎱㈡煡璇㈣鍛? ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (isSlowQuery) {
          this.logger.warn(`鈿狅笍 鎱㈡煡璇㈣鍛? ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (inDevDebug && isOrchestrationQuery) {
          this.logger.debug(`馃搳 缂栨帓鏌ヨ: ${summary}`)
        }
      })
    }

    attach(this)
    if (this.extendedClient) attach(this.extendedClient)
    this.logger.log('鏌ヨ鎬ц兘鐩戞帶宸插惎鐢?)
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
    ;(this as PrismaClient).$on('beforeExit' as never, async () => {
      await app.close()
    })
  }

  getClient(): ExtendedPrismaClient | Prisma.TransactionClient {
    const tx = this.cls.get(TRANSACTION_KEY) as Prisma.TransactionClient | undefined
    return tx || this.extendedClient || (this as unknown as ExtendedPrismaClient)
  }

  async runInTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
    },
  ): Promise<T> {
    const txId = Math.random().toString(36).substring(2, 8)
    const existingTx = this.cls.get(TRANSACTION_KEY) as Prisma.TransactionClient | undefined

    if (existingTx) {
      try {
        return await fn(existingTx)
      } catch (error) {
        this.logger.error(`[TX:${txId}] 鍦ㄧ幇鏈変簨鍔′腑鎵ц澶辫触: ${(error as Error).message}`)
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
        this.logger.error(`[TX:${txId}] 鏂颁簨鍔℃墽琛屽け璐? ${(error as Error).message}`)
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
