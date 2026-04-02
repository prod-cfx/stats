import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { SuperTest, Test as SupertestTest } from 'supertest'
import { randomBytes } from 'node:crypto'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { PrismaService } from '@/prisma/prisma.service'
import { supertestRequest } from '../helpers/supertest-compat'

export const API_PREFIX = 'api/v1'

type HttpServer = ReturnType<INestApplication['getHttpServer']>
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type SupertestAgent = SuperTest<SupertestTest>

export interface ApiClient {
  get: (path: string) => SupertestAgent
  post: (path: string) => SupertestAgent
  put: (path: string) => SupertestAgent
  patch: (path: string) => SupertestAgent
  delete: (path: string) => SupertestAgent
}

export interface CreateTestingAppOptions {
  /**
   * 需要覆盖的模块列表，默认为 AppModule
   */
  imports?: any[]
  /**
   * 自定义全局前缀，默认沿用 API_PREFIX
   */
  globalPrefix?: string
  /**
   * 允许调用方注入额外的 app 设置逻辑
   */
  onAppInit?: (app: INestApplication) => Promise<void> | void
  /**
   * 测试中按需覆盖 provider
   */
  providerOverrides?: Array<{
    provide: any
    useValue: any
  }>
}

interface NormalizedCreateTestingAppOptions {
  imports: any[]
  globalPrefix: string
  onAppInit?: (app: INestApplication) => Promise<void> | void
  providerOverrides?: Array<{
    provide: any
    useValue: any
  }>
}

export interface TestingAppContext {
  app: INestApplication
  moduleFixture: TestingModule
  prisma?: PrismaService
}

async function resolveCreateTestingAppOptions(
  input?: CreateTestingAppOptions | any[],
): Promise<NormalizedCreateTestingAppOptions> {
  const resolveDefaultImports = async () => {
    // Avoid importing AppModule eagerly so focused E2E suites can bootstrap
    // a smaller module graph without pulling unrelated runtime dependencies.
    const { AppModule } = await import('@/modules/app.module')
    return [AppModule]
  }

  if (Array.isArray(input)) {
    return {
      imports: input,
      globalPrefix: API_PREFIX,
    }
  }

  const options = input ?? {}
  return {
    imports: options.imports ?? await resolveDefaultImports(),
    globalPrefix: options.globalPrefix ?? API_PREFIX,
    onAppInit: options.onAppInit,
    providerOverrides: options.providerOverrides ?? [],
  }
}

// ---------------------------------------------------------------------------
// HTTP client factories
// ---------------------------------------------------------------------------

function buildPrefixedClient(server: HttpServer, token?: string): ApiClient {
  const applyAuth = (req: any): any => {
    if (token)
      req.set('Authorization', `Bearer ${token}`)
    return req
  }

  const createMethod = (method: HttpMethod) => (path: string) => {
    return applyAuth(
      supertestRequest(server)[method](buildApiUrl(path)) as SupertestAgent,
    )
  }

  return {
    get: createMethod('get'),
    post: createMethod('post'),
    put: createMethod('put'),
    patch: createMethod('patch'),
    delete: createMethod('delete'),
  }
}

function buildRawClient(server: HttpServer): ApiClient {
  const createMethod = (method: HttpMethod) => (path: string) => {
    return supertestRequest(server)[method](path) as SupertestAgent
  }

  return {
    get: createMethod('get'),
    post: createMethod('post'),
    put: createMethod('put'),
    patch: createMethod('patch'),
    delete: createMethod('delete'),
  }
}

/**
 * 创建公开请求客户端（自动添加 API 前缀）
 */
export function createApiClient(app: INestApplication): ApiClient {
  return buildPrefixedClient(app.getHttpServer())
}

/**
 * 创建带认证的请求客户端（自动添加 API 前缀 + Bearer token）
 */
export function createAuthApiClient(app: INestApplication, token: string): ApiClient {
  return buildPrefixedClient(app.getHttpServer(), token)
}

/**
 * 创建原始请求客户端（不添加 API 前缀，用于 /health、/metrics 等路由）
 */
export function createRawClient(app: INestApplication): ApiClient {
  return buildRawClient(app.getHttpServer())
}

export function buildApiUrl(endpoint: string): string {
  if (!endpoint) {
    return `/${API_PREFIX}`
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint

  if (cleanEndpoint.startsWith(`${API_PREFIX}/`) || cleanEndpoint === API_PREFIX) {
    return `/${cleanEndpoint}`
  }

  const apiPattern = /^api\/v\d+\//
  if (apiPattern.test(cleanEndpoint)) {
    return `/${cleanEndpoint}`
  }

  return `/${API_PREFIX}/${cleanEndpoint}`
}

/**
 * 创建测试应用，支持通过对象或模块数组两种形式传入选项
 */
export async function createTestingApp(
  options?: CreateTestingAppOptions | any[],
): Promise<TestingAppContext> {
  if (!process.env.APP_ENV || !['test', 'e2e'].includes(process.env.APP_ENV)) {
    console.warn('[E2E] 警告: 测试未在测试环境中运行，可能会影响生产数据库')
  }

  const normalizedOptions = await resolveCreateTestingAppOptions(options)
  let moduleBuilder = Test.createTestingModule({
    imports: normalizedOptions.imports,
  })
    .overrideProvider(MarketDataIngestionService)
    .useValue({
      onModuleInit: () => {},
      onModuleDestroy: () => {},
      handleGapFill: () => {},
      handleDynamicSymbolRefresh: () => {},
      ensureSymbolsSubscribed: async () => {},
    })

  for (const override of normalizedOptions.providerOverrides ?? []) {
    moduleBuilder = moduleBuilder
      .overrideProvider(override.provide)
      .useValue(override.useValue)
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile()

  const app = moduleFixture.createNestApplication()

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      enableDebugMessages: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const errorMessages = errors.map(err => ({
          property: err.property,
          constraints: err.constraints,
          value: err.value,
        }))
        // 输出详细的校验错误，便于定位 400 来源
        try {
          console.error('[E2E ValidationErrors]', JSON.stringify(errorMessages))
        }
        catch {}
        return new BadRequestException(errorMessages)
      },
    }),
  )

  app.setGlobalPrefix(normalizedOptions.globalPrefix)

  if (normalizedOptions.onAppInit)
    await normalizedOptions.onAppInit(app)

  await app.init()

  let prisma: PrismaService | undefined
  try {
    prisma = moduleFixture.get(PrismaService, { strict: false })
  }
  catch {
    prisma = undefined
  }
  return { app, moduleFixture, prisma }
}

export function generateRandomString(length: number = 10): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  if (length <= 0)
    return ''

  const randomBuffer = randomBytes(length)
  let result = ''

  for (let i = 0; i < length; i++) {
    const index = randomBuffer[i] % characters.length
    result += characters.charAt(index)
  }

  return result
}
