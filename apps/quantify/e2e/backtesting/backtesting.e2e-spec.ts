import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { Response } from 'supertest'
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
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

describe('backtestingController (e2e)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let runnerMock: { run: jest.Mock }
  let marketDataMock: { prepareData: jest.Mock; loadBars: jest.Mock; resolveCoverage: jest.Mock }
  let callerMock: { resolveCallerUserIdFromAuthorization: jest.Mock }
  let strategyAdapterMock: { build: jest.Mock }

  beforeEach(async () => {
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
        scriptCode: 'return { type: "NOOP" }',
        params: { fast: 9, slow: 21 },
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
        scriptCode: 'return { type: "NOOP" }',
        params: { fast: 9, slow: 21 },
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
        scriptCode: 'return { type: "NOOP" }',
        params: { fast: 9, slow: 21 },
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
        scriptCode: 'return { type: "NOOP" }',
        params: { fast: 9, slow: 21 },
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
        scriptCode: 'return { type: "NOOP" }',
        params: { fast: 9, slow: 21 },
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
