import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { SuperTest, Test as SupertestTest } from 'supertest'
import { randomBytes } from 'node:crypto'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '@/modules/app.module'
import { PrismaService } from '@/prisma/prisma.service'
import { supertestRequest } from '../helpers/supertest-compat'

/**
 * API鍓嶇紑甯搁噺
 */
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
   * 闇€瑕佽鐩栫殑妯″潡鍒楄〃锛岄粯璁や负 AppModule
   */
  imports?: any[]
  /**
   * 鑷畾涔夊叏灞€鍓嶇紑锛岄粯璁ゆ部鐢?API_PREFIX
   */
  globalPrefix?: string
  /**
   * 鍏佽璋冪敤鏂规敞鍏ラ澶栫殑 app 璁剧疆閫昏緫
   */
  onAppInit?: (app: INestApplication) => Promise<void> | void
}

interface NormalizedCreateTestingAppOptions {
  imports: any[]
  globalPrefix: string
  onAppInit?: (app: INestApplication) => Promise<void> | void
}

export interface TestingAppContext {
  app: INestApplication
  moduleFixture: TestingModule
  prisma: PrismaService
}

function resolveCreateTestingAppOptions(
  input?: CreateTestingAppOptions | any[],
): NormalizedCreateTestingAppOptions {
  if (Array.isArray(input)) {
    return {
      imports: input,
      globalPrefix: API_PREFIX,
    }
  }

  const options = input ?? {}
  return {
    imports: options.imports ?? [AppModule],
    globalPrefix: options.globalPrefix ?? API_PREFIX,
    onAppInit: options.onAppInit,
  }
}

function buildApiClient(server: HttpServer, token?: string): ApiClient {
  const applyAuth = (req: SupertestAgent): SupertestAgent => {
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

export function createApiClient(app: INestApplication, token?: string): ApiClient {
  return buildApiClient(app.getHttpServer(), token)
}

/**
 * 鏋勫缓瀹屾暣API URL
 * @param endpoint API绔偣璺緞
 * @returns 娣诲姞浜咥PI鍓嶇紑鐨勫畬鏁碪RL
 */
export function buildApiUrl(endpoint: string): string {
  // 濡傛灉涓虹┖鐩存帴杩斿洖API鍓嶇紑
  if (!endpoint) {
    return `/${API_PREFIX}`
  }

  // 绉婚櫎寮€澶寸殑鏂滄潬浠ヤ究缁熶竴澶勭悊
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint

  // 妫€鏌ユ槸鍚﹀凡缁忓寘鍚獳PI鍓嶇紑
  if (cleanEndpoint.startsWith(`${API_PREFIX}/`) || cleanEndpoint === API_PREFIX) {
    return `/${cleanEndpoint}`
  }

  // 妫€鏌ユ槸鍚﹀凡缁忔槸瀹屾暣鐨凙PI璺緞浣嗘病鏈堿PI_PREFIX鍓嶅閮ㄥ垎
  const apiPattern = /^api\/v\d+\//
  if (apiPattern.test(cleanEndpoint)) {
    return `/${cleanEndpoint}`
  }

  // 娣诲姞API鍓嶇紑
  return `/${API_PREFIX}/${cleanEndpoint}`
}

/**
 * 鍒涘缓娴嬭瘯搴旂敤
 * @param options 鍏佽閫氳繃瀵硅薄鎴栬€呯洿鎺ヤ紶鍏ユā鍧楁暟缁?
 * @returns 娴嬭瘯搴旂敤涓婁笅鏂囷紙鍖呭惈 app / module / prisma锛?
 */
export async function createTestingApp(
  options?: CreateTestingAppOptions | any[],
): Promise<TestingAppContext> {
  // 纭繚浣跨敤娴嬭瘯鐜閰嶇疆
  if (!process.env.APP_ENV || !['test', 'e2e'].includes(process.env.APP_ENV)) {
    console.warn('[E2E] 璀﹀憡: 娴嬭瘯鏈湪娴嬭瘯鐜涓繍琛岋紝鍙兘浼氬奖鍝嶇敓浜ф暟鎹簱')
  }

  const normalizedOptions = resolveCreateTestingAppOptions(options)
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: normalizedOptions.imports,
  }).compile()

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
        // 杈撳嚭璇︾粏鐨勬牎楠岄敊璇紝渚夸簬瀹氫綅 400 鏉ユ簮
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

  const prisma = moduleFixture.get(PrismaService)
  return { app, moduleFixture, prisma }
}

/**
 * 鐢熸垚闅忔満瀛楃涓?
 * @param length 闀垮害
 * @returns 闅忔満瀛楃涓?
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

/**
 * 娓呯悊娴嬭瘯鏁版嵁
 * @param prisma Prisma service
 */
export async function cleanupTestData(prisma: PrismaService) {
  try {
    // 瀹夊叏妫€鏌ワ細纭繚鍙湪娴嬭瘯鏁版嵁搴撲腑娓呯悊鏁版嵁
    if (!['test', 'e2e', 'development', 'dev'].includes(process.env.APP_ENV || '')) {
      console.warn('[E2E] 璀﹀憡: 涓嶅湪娴嬭瘯鐜涓紝璺宠繃鏁版嵁娓呯悊')
      return
    }

    // 鎸夌収渚濊禆鍏崇郴椤哄簭鍒犻櫎鏁版嵁锛岄伩鍏嶅閿害鏉熷啿绐?
    const _client = prisma.getClient()
    const deleteOperations = [
      // 鏍规嵁褰撳墠椤圭洰鐨勫疄闄呰〃缁撴瀯鍒犻櫎鏁版嵁
      // 绀轰緥锛氬厛鍒犻櫎渚濊禆琛紝鍐嶅垹闄や富琛?
      // client.comments.deleteMany(),
      // client.posts.deleteMany(),
      // client.users.deleteMany(),
    ]

    // 閫愪釜鎵ц鍒犻櫎鎿嶄綔
    for (const operation of deleteOperations) {
      try {
        await operation
      }
      catch (e) {
        // 蹇界暐鍗曚釜鍒犻櫎澶辫触锛岀户缁鐞嗕笅涓€涓?
        console.warn('[E2E] 娓呯悊鎿嶄綔澶辫触:', e)
      }
    }
  }
  catch (error) {
    console.error('[E2E] 娓呯悊娴嬭瘯鏁版嵁澶辫触:', error)
  }
}

/**
 * 纭繚鎵€鏈?Prisma 鏁版嵁搴撹〃瀛樺湪
 * 瑙ｅ喅娴嬭瘯鐜涓彲鑳介亣鍒扮殑琛ㄤ笉瀛樺湪闂
 * @param prisma PrismaService 瀹炰緥
 */
export async function ensurePrismaTablesExist(prisma: PrismaService): Promise<void> {
  // 灏濊瘯绠€鍗曟煡璇㈠悇涓〃浠ョ‘淇濆畠浠瓨鍦?
  // 濡傛灉琛ㄤ笉瀛樺湪浼氭姏鍑哄紓甯?
  try {
    const _client = prisma.getClient()
    // 褰撴湁琛ㄦ椂娣诲姞妫€鏌?
    // await client.user.findFirst({ take: 1 })
    // await client.post.findFirst({ take: 1 })
  }
  catch (error) {
    console.error('[E2E] 妫€鏌ユ暟鎹簱琛ㄥけ璐?', error)
    throw error
  }
}
