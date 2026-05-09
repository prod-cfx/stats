import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { SuperTest, Test as SupertestTest } from 'supertest'
import type { StrategyAstV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import type { PublishedStrategyAstSnapshot } from '@/modules/llm-strategy-codegen/types/publication-gate'
import { randomBytes } from 'node:crypto'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createEnvAccessor } from '@/common/env/env.accessor'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
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
  const appEnv = createEnvAccessor(process.env).raw('APP_ENV')
  if (!appEnv || !['test', 'e2e'].includes(appEnv)) {
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

export const SEMANTIC_EMA_STACK_EXECUTION_SEMANTIC_KEY = 'on_start.entry.primary'

export interface SemanticEmaStackSnapshotOptions {
  id?: string
  sessionId?: string
  strategyTemplateId?: string
  strategyInstanceId?: string
  snapshotHash?: string
  exchange?: 'binance' | 'okx' | 'hyperliquid'
  symbol?: string
  timeframe?: string
  marketType?: 'spot' | 'perp'
  positionPct?: number
}

export function createSemanticEmaStackCompiledSnapshotFixture(
  options: SemanticEmaStackSnapshotOptions = {},
) {
  const ir = createSemanticEmaStackIrFixture(options)
  const ast = new CanonicalStrategyAstCompilerService().compile(ir) as StrategyAstV1 & PublishedStrategyAstSnapshot
  ast.runtimeExecutionSemantics = [{
    semanticKey: SEMANTIC_EMA_STACK_EXECUTION_SEMANTIC_KEY,
    trigger: 'on_start',
    phase: 'entry',
    consumePolicy: 'once',
    requiredRuntimeContext: {
      barIndex: 1,
      requiresReferenceBar: true,
      requiresSymbol: true,
      requiresTimeframe: true,
    },
    sourceRefs: ['entry_ema_stack'],
  }]
  const executionEnvelope = createSemanticEmaStackExecutionEnvelope(options)
  const emitter = new CompiledScriptEmitterService()
  const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
  const projection = emitter.buildProjection({ ast, executionEnvelope })

  return {
    ir,
    ast,
    executionEnvelope,
    scriptSnapshot,
    compiledManifest: projection.compiledManifest,
  }
}

export function createSemanticEmaStackPublishedSnapshotFixture(
  options: SemanticEmaStackSnapshotOptions = {},
) {
  const compiledSnapshot = createSemanticEmaStackCompiledSnapshotFixture(options)
  const exchange = options.exchange ?? 'binance'
  const symbol = options.symbol ?? 'BTCUSDT'
  const timeframe = options.timeframe ?? '15m'
  const marketType = options.marketType ?? 'spot'
  const positionPct = options.positionPct ?? 10

  return {
    id: options.id ?? 'semantic-ema-stack-snapshot',
    sessionId: options.sessionId ?? 'semantic-ema-stack-session',
    strategyTemplateId: options.strategyTemplateId ?? 'semantic-ema-stack-template',
    strategyInstanceId: options.strategyInstanceId ?? 'semantic-ema-stack-instance',
    snapshotHash: options.snapshotHash ?? 'semantic-ema-stack-snapshot-hash',
    scriptHash: 'semantic-ema-stack-script-hash',
    specHash: compiledSnapshot.compiledManifest.specHash,
    irHash: compiledSnapshot.compiledManifest.irHash,
    astDigest: compiledSnapshot.compiledManifest.astDigest,
    structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
    scriptSnapshot: compiledSnapshot.scriptSnapshot,
    specSnapshot: {
      version: 2,
      market: { exchange, symbol, marketType, defaultTimeframe: timeframe },
      indicators: [
        { id: 'ema_fast', kind: 'ema', params: { period: 7 } },
        { id: 'ema_slow', kind: 'ema', params: { period: 21 } },
      ],
      rules: [{
        id: 'entry_ema_stack',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          key: 'indicator.above',
          params: {
            indicator: 'ema',
            fastPeriod: 7,
            slowPeriod: 21,
            timeframe,
          },
        },
        actions: [{ key: 'open_long', sizing: { mode: 'fixed_ratio', value: positionPct / 100 } }],
      }, {
        id: 'exit_ema_stack',
        phase: 'exit',
        sideScope: 'long',
        condition: {
          key: 'indicator.below',
          params: {
            indicator: 'ema',
            fastPeriod: 7,
            slowPeriod: 21,
            timeframe,
          },
        },
        actions: [{ key: 'close_long' }],
      }],
      risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 4, basis: 'entry_avg_price' } }],
      position: { mode: 'fixed_ratio', value: positionPct / 100, positionMode: 'long_only' },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    },
    semanticGraph: {
      version: 'semantic-strategy-graph.v1',
      nodes: [
        { id: 'ema_fast', kind: 'indicator', indicator: 'ema', params: { period: 7 } },
        { id: 'ema_slow', kind: 'indicator', indicator: 'ema', params: { period: 21 } },
      ],
      actions: [{ id: 'open_long', kind: 'OPEN_LONG' }, { id: 'close_long', kind: 'CLOSE_LONG' }],
    },
    compiledIr: compiledSnapshot.ir,
    irSnapshot: compiledSnapshot.ir,
    astSnapshot: compiledSnapshot.ast,
    compiledManifest: compiledSnapshot.compiledManifest,
    consistencyReport: {
      status: 'PASSED',
      checks: [{
        id: 'semantic_ema_stack_fixture_ir_spec_phase_alignment',
        status: 'passed',
        message: 'Spec snapshot, IR, AST, and emitted script all include entry and exit EMA stack phases.',
      }],
    },
    userIntentSummary: { marketScope: [symbol], thesis: 'EMA stack semantic fixture' },
    strategySummary: { thesis: 'Open long when fast EMA is above slow EMA.' },
    scriptSummary: { indicators: ['EMA'], runtime: 'compiler.v1' },
    paramsSnapshot: {
      exchange,
      symbol,
      timeframe,
      positionPct,
      marketType,
    },
    strategyConfig: {
      exchange,
      symbol,
      timeframe,
      baseTimeframe: timeframe,
      stateTimeframes: [timeframe],
      positionPct,
      marketType,
      strategyDeclaredLeverageRange: null,
    },
    backtestConfigDefaults: {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: false,
    },
    deploymentExecutionDefaults: {
      leverage: 1,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'GTC',
    },
    deploymentExecutionConstraints: {
      platformRiskMaxLeverage: 1,
      strategyDeclaredLeverageRange: null,
      defaultLeverage: 1,
      supportedPriceSources: ['close'],
      supportedOrderTypes: ['market'],
      supportedTimeInForce: ['GTC'],
      constraintExplanation: 'semantic EMA stack e2e fixture',
    },
    lockedParams: {
      exchange,
      symbol,
      timeframe,
      positionPct,
      marketType,
    },
    executionEnvelope: compiledSnapshot.executionEnvelope,
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { primary: [timeframe], requiredTimeframes: [timeframe], warmupBars: 21 },
    snapshotVersion: 2,
  }
}

function createSemanticEmaStackIrFixture(
  options: SemanticEmaStackSnapshotOptions,
): CanonicalStrategyIrV1 {
  const exchange = options.exchange ?? 'binance'
  const symbol = options.symbol ?? 'BTCUSDT'
  const timeframe = options.timeframe ?? '15m'
  const positionPct = options.positionPct ?? 10
  const instrumentType = options.marketType === 'perp' ? 'perpetual' : 'spot'
  const closeSeriesId = `close_${timeframe}`

  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      specHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    },
    market: {
      venue: exchange,
      instrumentType,
      symbol,
      timeframes: [timeframe],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: positionPct },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 21,
      maxLookback: 21,
      requiredTimeframes: [timeframe],
    },
    signalCatalog: {
      series: [
        { id: closeSeriesId, kind: 'PRICE', timeframe, field: 'close' },
        { id: 'ema_fast', kind: 'EMA', inputs: [closeSeriesId], params: { period: 7 } },
        { id: 'ema_slow', kind: 'EMA', inputs: [closeSeriesId], params: { period: 21 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_ema_stack', kind: 'GT', args: ['ema_fast', 'ema_slow'] },
        { id: 'exit_ema_stack', kind: 'LT', args: ['ema_fast', 'ema_slow'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_ema_stack',
        phase: 'entry',
        when: 'entry_ema_stack',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: positionPct } },
        ],
      },
      {
        id: 'exit_ema_stack',
        phase: 'exit',
        when: 'exit_ema_stack',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [
        { id: 'stop_loss_4', kind: 'STOP_LOSS_PCT', scope: 'position', value: 4, onBreach: 'FORCE_EXIT' },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }
}

function createSemanticEmaStackExecutionEnvelope(options: SemanticEmaStackSnapshotOptions) {
  return {
    positionMode: 'long_only' as const,
    marginMode: options.marketType === 'perp' ? 'cross' as const : 'cash' as const,
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict' as const,
  }
}
