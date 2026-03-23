import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '@/modules/app.module'
import { MARKET_DATA_PROVIDER } from '@/modules/market-data/constants/market-data.constants'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

describe('market-data (e2e)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let prisma: PrismaService
  let symbolId: string
  let perpSymbolId: string

  const mockProvider = {
    name: 'BINANCE',
    fetchSymbols: jest.fn().mockResolvedValue([]),
    fetchHistoricalBars: jest.fn().mockResolvedValue([]),
    subscribe: jest.fn().mockResolvedValue(async () => {}),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }

  async function upsertTestSymbol(
    prisma: PrismaService,
    params: { code: string; instrumentType?: string },
  ): Promise<string> {
    const result = await prisma.symbol.upsert({
      where: { code: params.code },
      create: {
        code: params.code,
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        type: 'CRYPTO',
        instrumentType: params.instrumentType ?? 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
      update: { status: 'ACTIVE' },
      select: { id: true },
    })
    return result.id
  }

  function createTestMarketQuote(
    prisma: PrismaService,
    symbolId: string,
    data: { lastPrice: string; eventTime: Date },
  ) {
    return prisma.marketQuote.create({ data: { symbolId, source: 'TEST', ...data } })
  }

  function createTestMarketBars(
    prisma: PrismaService,
    symbolId: string,
    bars: Array<{ timeframe: string; time: Date; open: string; high: string; low: string; close: string }>,
  ) {
    return prisma.marketBar.createMany({ data: bars.map(b => ({ symbolId, source: 'TEST', ...b })) })
  }

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MARKET_DATA_PROVIDER)
      .useValue(mockProvider)
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

    prisma = moduleFixture.get(PrismaService)

    symbolId = await upsertTestSymbol(prisma, { code: 'BTCUSDT:SPOT', instrumentType: 'SPOT' })
    perpSymbolId = await upsertTestSymbol(prisma, { code: 'BTCUSDT:PERP', instrumentType: 'PERPETUAL' })
  })

  afterEach(async () => {
    if (prisma) {
      await prisma.marketQuote.deleteMany({ where: { symbolId: { in: [symbolId, perpSymbolId] } } })
      await prisma.marketBar.deleteMany({ where: { symbolId: { in: [symbolId, perpSymbolId] } } })
      await prisma.symbol.deleteMany({ where: { id: { in: [symbolId, perpSymbolId] } } })
    }

    if (app) {
      await app.close()
    }
  })

  it('GET /api/v1/market/quote should return latest quote', async () => {
    await createTestMarketQuote(prisma, symbolId, {
      lastPrice: '65000.12',
      eventTime: new Date('2026-03-17T10:00:00.000Z'),
    })

    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl('market/quote'))
      .query({ symbol: 'BTCUSDT' })
      .expect(200)
      .expect((res) => {
        const payload = res.body.data ?? res.body
        expect(payload.symbol).toBe('BTCUSDT:SPOT')
        expect(payload.lastPrice).toBe('65000.12')
      })
  })

  it('GET /api/v1/market/quote should keep query symbol in error args when symbol is missing', async () => {
    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl('market/quote'))
      .query({ symbol: 'NOTEXIST' })
      .expect(400)
      .expect((res) => {
        expect(res.body?.error?.code).toBe('MARKET_SYMBOL_NOT_FOUND')
        expect(res.body?.error?.args?.symbol).toBe('NOTEXIST')
      })
  })

  it('GET /api/v1/market/bars should return bars in ascending time order', async () => {
    await createTestMarketBars(prisma, symbolId, [
      {
        timeframe: 'h1',
        time: new Date('2026-03-17T08:00:00.000Z'),
        open: '64000',
        high: '64500',
        low: '63800',
        close: '64300',
      },
      {
        timeframe: 'h1',
        time: new Date('2026-03-17T09:00:00.000Z'),
        open: '64300',
        high: '64600',
        low: '64200',
        close: '64500',
      },
    ])

    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl('market/bars'))
      .query({ symbol: 'BTCUSDT', timeframe: '1h', limit: 10 })
      .expect(200)
      .expect((res) => {
        const payload = res.body.data ?? res.body
        expect(Array.isArray(payload)).toBe(true)
        expect(payload.length).toBe(2)
        expect(new Date(payload[0].time).getTime()).toBeLessThan(new Date(payload[1].time).getTime())
      })
  })

  it('GET /api/v1/market/bars should reject invalid limit through validation pipe', async () => {
    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl('market/bars'))
      .query({ symbol: 'BTCUSDT', timeframe: '1h', limit: 'abc' })
      .expect(400)
      .expect((res) => {
        const errorCode = res.body?.error?.code ?? res.body?.error ?? res.body?.statusCode

        expect(['BAD_REQUEST', 'Bad Request', 400]).toContain(errorCode)
      })
  })

  it('GET /api/v1/market/bars supports :PERP symbol', async () => {
    await createTestMarketBars(prisma, perpSymbolId, [
      {
        timeframe: 'm1',
        time: new Date('2026-03-17T10:00:00.000Z'),
        open: '64000',
        high: '64500',
        low: '63800',
        close: '64300',
      },
    ])

    await supertestRequest(app.getHttpServer())
      .get(buildApiUrl('market/bars'))
      .query({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })
      .expect(200)
      .expect((res) => {
        const payload = res.body.data ?? res.body
        expect(payload.length).toBe(1)
        expect(payload[0].close).toBe('64300')
      })
  })
})
