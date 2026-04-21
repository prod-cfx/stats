import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { Response } from 'supertest'
import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { BacktestingModule } from '@/modules/backtesting/backtesting.module'
import { BacktestRunnerService } from '@/modules/backtesting/core/backtest-runner.service'
import { BacktestCallerIdentityService } from '@/modules/backtesting/services/backtest-caller-identity.service'
import { BacktestMarketDataService } from '@/modules/backtesting/services/backtest-market-data.service'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

describe('backtestingController (e2e)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let runnerMock: { run: jest.Mock }
  let marketDataMock: {
    ensureBacktestSymbolAvailable: jest.Mock
    prepareData: jest.Mock
    loadBars: jest.Mock
    resolveCoverage: jest.Mock
  }
  let callerMock: { resolveCallerUserIdFromAuthorization: jest.Mock }
  let strategyAdapterMock: { build: jest.Mock }
  let snapshotsRepositoryMock: { findByIdForUser: jest.Mock }

  beforeEach(async () => {
    const compiledSnapshot = createCompiledSnapshotFixture()
    const report = {
      summary: {
        netProfit: 10,
        netProfitPct: 0.001,
        maxDrawdownPct: 0,
        winRate: 1,
        profitFactor: 10,
        totalTrades: 1,
      },
      equityCurve: [{ ts: 1, equity: 10010 }],
      trades: [
        {
          id: 't1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryTs: 1,
          entryPrice: 100,
          exitTs: 2,
          exitPrice: 110,
          qty: 1,
          fee: 0,
          pnl: 10,
          returnPct: 0.1,
        },
      ],
      markers: [
        { symbol: 'BTCUSDT', ts: 1, price: 100, kind: 'entry_long', tradeId: 't1' },
        { symbol: 'BTCUSDT', ts: 2, price: 110, kind: 'exit_long', tradeId: 't1' },
      ],
      bySymbol: [{ symbol: 'BTCUSDT', pnl: 10, trades: 1, winRate: 1 }],
      openPositions: [],
    }

    runnerMock = {
      run: jest.fn().mockResolvedValue(report),
    }
    marketDataMock = {
      ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
      prepareData: jest.fn().mockResolvedValue(undefined),
      resolveCoverage: jest.fn().mockResolvedValue({
        kind: 'full',
        availableRange: { fromTs: 1, toTs: 2 },
        appliedRange: { fromTs: 1, toTs: 2 },
      }),
      loadBars: jest.fn().mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: 1,
          closeTime: 2,
          open: 100,
          high: 110,
          low: 90,
          close: 105,
          volume: 100,
        },
      ]),
    }
    callerMock = {
      resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1'),
    }
    strategyAdapterMock = {
      build: jest.fn().mockResolvedValue({
        id: 'demo-strategy',
        params: {},
        fn: () => ({ type: 'NOOP' }),
      }),
    }
    snapshotsRepositoryMock = {
      findByIdForUser: jest.fn().mockResolvedValue(createPublishedSnapshotFixture(compiledSnapshot)),
    }

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        EnvModule,
        ClsConfigModule,
        PrismaModule,
        BacktestingModule,
      ],
    })
      .overrideProvider(BacktestRunnerService)
      .useValue(runnerMock)
      .overrideProvider(BacktestMarketDataService)
      .useValue(marketDataMock)
      .overrideProvider(MarketDataIngestionService)
      .useValue({
        onModuleInit: () => {},
        onModuleDestroy: () => {},
        handleGapFill: () => {},
        handleDynamicSymbolRefresh: () => {},
        ensureSymbolsSubscribed: async () => {},
      })
      .overrideProvider(BacktestCallerIdentityService)
      .useValue(callerMock)
      .overrideProvider(BacktestStrategyAdapterService)
      .useValue(strategyAdapterMock)
      .overrideProvider(PublishedStrategySnapshotsRepository)
      .useValue(snapshotsRepositoryMock)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    app.setGlobalPrefix('api/v1')
    await app.init()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('POST /api/v1/backtesting/run should return json report', async () => {
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      allowPartial: false,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 'demo-strategy',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { fast: 9, slow: 21, marketType: 'spot' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: 1,
          closeTime: 2,
          open: 100,
          high: 110,
          low: 90,
          close: 105,
          volume: 100,
        },
      ],
    }

    await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/run'))
      .set('Authorization', 'Bearer test-token')
      .send(payload)
      .expect(201)
      .expect((res: Response) => {
        expect(res.body).toHaveProperty('summary')
        expect(res.body).toHaveProperty('markers')
        expect(res.body.summary.totalTrades).toBe(1)
      })

    expect(runnerMock.run).toHaveBeenCalledTimes(1)
    expect(runnerMock.run).toHaveBeenCalledWith(expect.objectContaining({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
    }))
  })

  it('POST /api/v1/backtesting/run should reject invalid leverage', async () => {
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 0,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 'demo-strategy',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { fast: 9, slow: 21, marketType: 'spot' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        {
          symbol: 'BTCUSDT',
          timeframe: '5m',
          openTime: 1,
          closeTime: 2,
          open: 100,
          high: 110,
          low: 90,
          close: 105,
          volume: 100,
        },
      ],
    }

    await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/run'))
      .set('Authorization', 'Bearer test-token')
      .send(payload)
      .expect(400)

    expect(runnerMock.run).toHaveBeenCalledTimes(0)
  })

  it('POST /api/v1/backtesting/run should reject tampered compiled snapshots before runner execution', async () => {
    const compiledSnapshot = createCompiledSnapshotFixture()
    const tamperedScript = compiledSnapshot.scriptSnapshot.replace(
      '"sourceRef":"entry_cross"',
      '"sourceRef":"entry_cross_mutated"',
    )

    snapshotsRepositoryMock.findByIdForUser.mockResolvedValueOnce(
      createPublishedSnapshotFixture(compiledSnapshot, { scriptSnapshot: tamperedScript }),
    )

    await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/run'))
      .set('Authorization', 'Bearer test-token')
      .send({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 10000,
        leverage: 2,
        allowPartial: false,
        execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
        strategy: {
          id: 'demo-strategy',
          protocolVersion: 'v1',
          publishedSnapshotId: 'snapshot-1',
          params: { fast: 9, slow: 21, marketType: 'spot' },
        },
        dataRange: { fromTs: 1, toTs: 2 },
        bars: [
          {
            symbol: 'BTCUSDT',
            timeframe: '5m',
            openTime: 1,
            closeTime: 2,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            volume: 100,
          },
        ],
      })
      .expect(400)
      .expect((res: Response) => {
        const serializedBody = JSON.stringify(res.body)
        expect(serializedBody).toContain('backtest.compiled_snapshot_invalid')
      })

    expect(runnerMock.run).not.toHaveBeenCalled()
  })

  it('POST /api/v1/backtesting/jobs should fail when market data is empty', async () => {
    marketDataMock.loadBars.mockResolvedValueOnce([])

    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      allowPartial: false,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 'demo-strategy',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { fast: 9, slow: 21, marketType: 'spot' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
    }

    const createRes = await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/jobs'))
      .set('Authorization', 'Bearer test-token')
      .send(payload)
      .expect(201)

    const jobId = createRes.body?.id as string
    expect(typeof jobId).toBe('string')
    expect(jobId.length).toBeGreaterThan(0)

    let status = createRes.body?.status as string
    for (let i = 0; i < 10 && status !== 'failed'; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0))
      const jobRes = await supertestRequest(app.getHttpServer())
        .get(buildApiUrl(`backtesting/jobs/${jobId}`))
        .set('Authorization', 'Bearer test-token')
        .expect(200)
      status = jobRes.body?.status as string
    }

    expect(status).toBe('failed')

    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl(`backtesting/jobs/${jobId}/result`))
      .set('Authorization', 'Bearer test-token')
      .expect(409)
  })

  it('POST /api/v1/backtesting/jobs should reject unsupported snapshot-bound symbols before job creation', async () => {
    marketDataMock.ensureBacktestSymbolAvailable.mockResolvedValueOnce({
      supported: false,
      reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
      args: {
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'ORDIUSDT',
        baseTimeframe: '1h',
      },
    })
    snapshotsRepositoryMock.findByIdForUser.mockResolvedValueOnce(
      createPublishedSnapshotFixture(createCompiledSnapshotFixture(), {
        strategyConfig: {
          exchange: 'okx',
          symbol: 'ORDIUSDT',
          marketType: 'spot',
          baseTimeframe: '1h',
          stateTimeframes: ['4h'],
          positionPct: 25,
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
        dataRequirements: { primary: ['1h'], requiredTimeframes: ['1h', '4h'] },
      }),
    )

    await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/jobs'))
      .set('Authorization', 'Bearer test-token')
      .send({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 10000,
        leverage: 2,
        allowPartial: false,
        execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
        strategy: {
          id: 'demo-strategy',
          protocolVersion: 'v1',
          publishedSnapshotId: 'snapshot-1',
          params: { fast: 9, slow: 21, marketType: 'spot' },
        },
        dataRange: { fromTs: 1, toTs: 2 },
      })
      .expect(400)
      .expect((res: Response) => {
        const errorCode = res.body?.error?.code ?? res.body?.code
        const errorArgs = res.body?.error?.args ?? res.body?.args
        const errorMessage = typeof res.body?.message === 'string'
          ? res.body.message
          : res.body?.debug?.rawResponse?.message

        expect(errorCode).toBe('BAD_REQUEST')
        expect(errorArgs).toMatchObject({
          reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
          exchange: 'okx',
          marketType: 'spot',
          symbol: 'ORDIUSDT',
          baseTimeframe: '1h',
          snapshotId: 'snapshot-1',
        })
        expect(errorMessage).toBe('backtesting.symbol_unavailable')
      })

    expect(marketDataMock.ensureBacktestSymbolAvailable).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })
    expect(marketDataMock.prepareData).not.toHaveBeenCalled()
    expect(runnerMock.run).not.toHaveBeenCalled()
  })

  it('POST /api/v1/backtesting/jobs should fail on partial coverage when allowPartial=false', async () => {
    marketDataMock.resolveCoverage.mockResolvedValueOnce({
      kind: 'partial',
      availableRange: { fromTs: 2, toTs: 2 },
      appliedRange: { fromTs: 2, toTs: 2 },
    })

    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      allowPartial: false,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 'demo-strategy',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { fast: 9, slow: 21, marketType: 'spot' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
    }

    const createRes = await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/jobs'))
      .set('Authorization', 'Bearer test-token')
      .send(payload)
      .expect(201)

    const jobId = createRes.body?.id as string
    let status = createRes.body?.status as string
    for (let i = 0; i < 10 && status !== 'failed'; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0))
      const jobRes = await supertestRequest(app.getHttpServer())
        .get(buildApiUrl(`backtesting/jobs/${jobId}`))
        .set('Authorization', 'Bearer test-token')
        .expect(200)
      status = jobRes.body?.status as string
    }

    expect(status).toBe('failed')
  })

  it('POST /api/v1/backtesting/jobs should apply partial range when allowPartial=true', async () => {
    marketDataMock.resolveCoverage.mockResolvedValueOnce({
      kind: 'partial',
      availableRange: { fromTs: 2, toTs: 2 },
      appliedRange: { fromTs: 2, toTs: 2 },
    })

    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      allowPartial: true,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 'demo-strategy',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { fast: 9, slow: 21, marketType: 'spot' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
    }

    const createRes = await supertestRequest(app.getHttpServer())
      .post(buildApiUrl('backtesting/jobs'))
      .set('Authorization', 'Bearer test-token')
      .send(payload)
      .expect(201)

    const jobId = createRes.body?.id as string
    let status = createRes.body?.status as string
    for (let i = 0; i < 10 && status !== 'succeeded'; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0))
      const jobRes = await supertestRequest(app.getHttpServer())
        .get(buildApiUrl(`backtesting/jobs/${jobId}`))
        .set('Authorization', 'Bearer test-token')
        .expect(200)
      status = jobRes.body?.status as string
      if (status === 'succeeded') {
        expect(jobRes.body?.inputSummary?.isPartial).toBe(true)
        expect(jobRes.body?.inputSummary?.appliedRange).toEqual({ fromTs: 2, toTs: 2 })
      }
    }

    expect(status).toBe('succeeded')
  })
})

function createCompiledSnapshotFixture() {
  const ir = createIrFixture()
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const executionEnvelope = createExecutionEnvelope()
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

function createPublishedSnapshotFixture(
  compiledSnapshot: ReturnType<typeof createCompiledSnapshotFixture>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'snapshot-1',
    strategyInstanceId: 'instance-1',
    strategyTemplateId: 'template-1',
    snapshotHash: 'snapshot-hash',
    scriptHash: 'script-hash',
    specHash: compiledSnapshot.compiledManifest.specHash,
    irHash: compiledSnapshot.compiledManifest.irHash,
    astDigest: compiledSnapshot.compiledManifest.astDigest,
    structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
    scriptSnapshot: compiledSnapshot.scriptSnapshot,
    paramsSnapshot: {
      symbol: 'BTCUSDT',
      timeframe: '5m',
      marketType: 'spot',
    },
    strategyConfig: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      positionPct: 25,
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
      timeInForce: 'gtc',
    },
    deploymentExecutionConstraints: {
      platformRiskMaxLeverage: 1,
      strategyDeclaredLeverageRange: null,
      defaultLeverage: 1,
      supportedPriceSources: ['close'],
      supportedOrderTypes: ['market'],
      supportedTimeInForce: ['gtc'],
      constraintExplanation: 'strategy/default constraints pending account-capability intersection',
    },
    lockedParams: {
      exchange: 'okx',
      positionPct: 25,
    },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { primary: ['5m'] },
    irSnapshot: compiledSnapshot.ir,
    astSnapshot: compiledSnapshot.ast,
    compiledManifest: compiledSnapshot.compiledManifest,
    executionEnvelope: compiledSnapshot.executionEnvelope,
    specSnapshot: {
      market: { exchange: 'okx' },
      indicators: [],
      riskRules: [],
    },
    ...overrides,
  }
}

function createIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: 'sha256:11aa',
      specHash: 'sha256:11aa',
    },
    market: {
      venue: 'binance',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 25 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 21,
      maxLookback: 21,
      requiredTimeframes: ['1h'],
    },
    signalCatalog: {
      series: [
        { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
        { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
        { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
        { id: 'exit_cross', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_cross',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_cross',
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

function createExecutionEnvelope() {
  return {
    positionMode: 'long_only' as const,
    marginMode: 'cash' as const,
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict' as const,
  }
}
