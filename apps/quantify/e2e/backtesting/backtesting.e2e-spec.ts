import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { BacktestingModule } from '@/modules/backtesting/backtesting.module'
import { BacktestRunnerService } from '@/modules/backtesting/core/backtest-runner.service'
import { supertestRequest } from '../helpers/supertest-compat'

describe('backtestingController (e2e)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let runnerMock: { run: jest.Mock }

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

    moduleFixture = await Test.createTestingModule({
      imports: [BacktestingModule],
    })
      .overrideProvider(BacktestRunnerService)
      .useValue(runnerMock)
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
    await app.close()
  })

  it('POST /api/v1/backtesting/run should return json report', async () => {
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: { id: 'demo-strategy', params: { fast: 9, slow: 21 } },
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
      .post('/api/v1/backtesting/run')
      .send(payload)
      .expect(201)
      .expect((res) => {
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
      strategy: { id: 'demo-strategy', params: { fast: 9, slow: 21 } },
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
      .post('/api/v1/backtesting/run')
      .send(payload)
      .expect(400)

    expect(runnerMock.run).toHaveBeenCalledTimes(0)
  })
})
