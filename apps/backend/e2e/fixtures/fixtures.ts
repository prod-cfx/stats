import type { INestApplication } from '@nestjs/common'
import type { TestingModule, TestingModuleBuilder } from '@nestjs/testing'
import type { SuperTest, Test as SupertestTest } from 'supertest'
import { randomBytes } from 'node:crypto'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaService } from '@/prisma/prisma.service'
import { ensureE2eDefaults, ensureE2eEnv } from '../helpers/setup-e2e-env'
import { supertestRequest } from '../helpers/supertest-compat'

/**
 * API前缀常量
 */
export const API_PREFIX = 'api/v1'

type HttpServer = ReturnType<INestApplication['getHttpServer']>
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type SupertestAgent = SuperTest<SupertestTest>

export interface CreateTestingAppOptions {
  /** 需要覆盖的模块列表，默认为 AppModule */
  imports?: any[]
  /** 自定义全局前缀，默认沿用 API_PREFIX */
  globalPrefix?: string
  /** 注入额外环境变量默认值（仅在未设置时生效） */
  envDefaults?: Record<string, string>
  /** 允许在 compile 前修改 TestingModuleBuilder（如 overrideGuard / overrideProvider） */
  onBeforeInit?: (builder: TestingModuleBuilder) => TestingModuleBuilder
  /** 允许调用方注入额外的 app 设置逻辑 */
  onAppInit?: (app: INestApplication) => Promise<void> | void
}

export interface TestingAppContext {
  app: INestApplication
  moduleFixture: TestingModule
  prisma?: PrismaService
}

export interface ApiClient {
  get: (path: string) => any
  post: (path: string) => any
  put: (path: string) => any
  patch: (path: string) => any
  delete: (path: string) => any
}

export interface CreateUserRecordInput {
  id: string
  email: string
  passwordHash?: string
  nickname?: string | null
  emailVerified?: boolean
  isGuest?: boolean
}

/**
 * 构建完整API URL
 * @param endpoint API端点路径
 * @returns 添加了API前缀的完整URL
 */
export function buildApiUrl(endpoint: string): string {
  // 如果为空直接返回API前缀
  if (!endpoint) {
    return `/${API_PREFIX}`
  }

  // 移除开头的斜杠以便统一处理
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint

  // 检查是否已经包含 API 前缀
  if (cleanEndpoint.startsWith(`${API_PREFIX}/`) || cleanEndpoint === API_PREFIX) {
    return `/${cleanEndpoint}`
  }

  // 检查是否已经是完整的 API 路径但没有 API_PREFIX 前导部分
  const apiPattern = /^api\/v\d+\//
  if (apiPattern.test(cleanEndpoint)) {
    return `/${cleanEndpoint}`
  }

  // 添加API前缀
  return `/${API_PREFIX}/${cleanEndpoint}`
}

// ---------------------------------------------------------------------------
// createTestingApp — 主工厂
// ---------------------------------------------------------------------------

/**
 * 创建测试应用
 * @param options 配置项（模块列表、全局前缀、环境变量、钩子等）
 * @returns 测试应用上下文（包含 app / moduleFixture / prisma）
 */
export async function createTestingApp(
  options?: CreateTestingAppOptions,
): Promise<TestingAppContext> {
  // 1. 确保 E2E 环境
  ensureE2eEnv()

  // 2. 注入环境变量默认值
  if (options?.envDefaults) {
    ensureE2eDefaults(options.envDefaults)
  }

  // 3. 解析 imports
  const imports = options?.imports ?? await resolveDefaultImports()

  // 4. 创建 TestingModuleBuilder
  let builder = Test.createTestingModule({ imports })

  // 5. onBeforeInit 钩子
  if (options?.onBeforeInit) {
    builder = options.onBeforeInit(builder)
  }

  // 6. compile
  const moduleFixture: TestingModule = await builder.compile()

  // 7. createNestApplication
  const app = moduleFixture.createNestApplication()

  // 8. ValidationPipe（与生产环境匹配）
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

  // 9. globalPrefix
  app.setGlobalPrefix(options?.globalPrefix ?? API_PREFIX)

  // 10. onAppInit 钩子
  if (options?.onAppInit) {
    await options.onAppInit(app)
  }

  // 11. init
  await app.init()

  // 12. 获取 PrismaService（允许失败）
  let prisma: PrismaService | undefined
  try {
    prisma = moduleFixture.get(PrismaService, { strict: false })
  }
  catch {
    prisma = undefined
  }

  return { app, moduleFixture, prisma }
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
 * 创建原始请求客户端（不添加 API 前缀，用于 /metrics 等路由）
 */
export function createRawClient(app: INestApplication): ApiClient {
  return buildRawClient(app.getHttpServer())
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * 生成随机字符串
 * @param length 长度
 * @returns 随机字符串
 */
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

export async function createUserRecord(
  prisma: PrismaService,
  input: CreateUserRecordInput,
) {
  return prisma.user.create({
    data: {
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash ?? 'e2e-password-hash',
      nickname: input.nickname ?? null,
      emailVerified: input.emailVerified ?? true,
      isGuest: input.isGuest ?? false,
    },
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveDefaultImports(): Promise<any[]> {
  // Avoid importing AppModule eagerly so focused E2E suites can bootstrap
  // a smaller module graph without pulling unrelated runtime dependencies.
  const { AppModule } = await import('@/modules/app.module')
  return [AppModule]
}
