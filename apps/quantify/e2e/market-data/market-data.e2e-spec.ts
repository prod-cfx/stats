import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '@/modules/app.module'
import { MARKET_DATA_PROVIDER } from '@/modules/market-data/constants/market-data.constants'
import { PrismaService } from '@/prisma/prisma.service'
import { supertestRequest } from '../helpers/supertest-compat'

describe('market-data (e2e)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let prisma: PrismaService
  let symbolId: string

  const mockProvider = {
    name: 'BINANCE',
    fetchSymbols: jest.fn().mockResolvedValue([]),
    fetchHistoricalBars: jest.fn().mockResolvedValue([]),
    subscribe: jest.fn().mockResolvedValue(async () => {}),
    disconnect: jest.fn().mockResolvedValue(undefined),
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

    const symbol = await prisma.symbol.upsert({
      where: { code: 'BTCUSDT' },
      create: {
        code: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        type: 'CRYPTO',
        instrumentType: 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
      update: {
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    symbolId = symbol.id
  })

  afterEach(async () => {
    if (prisma) {
      await prisma.marketQuote.deleteMany({ where: { symbolId } })
      await prisma.marketBar.deleteMany({ where: { symbolId } })
      await prisma.symbol.deleteMany({ where: { id: symbolId } })
    }

    if (app) {
      await app.close()
    }
  })

  it('GET /api/v1/market/quote should return latest quote', async () => {
    await prisma.marketQuote.create({
      data: {
        symbolId,
        lastPrice: '65000.12',
        eventTime: new Date('2026-03-17T10:00:00.000Z'),
        source: 'TEST',
      },
    })

    await supertestRequest(app.getHttpServer())
      .get('/api/v1/market/quote')
      .query({ symbol: 'BTCUSDT' })
      .expect(200)
      .expect((res) => {
        const payload = res.body.data ?? res.body
        expect(payload.symbol).toBe('BTCUSDT')
        expect(payload.lastPrice).toBe('65000.12')
      })
  })

  it('GET /api/v1/market/bars should return bars in ascending time order', async () => {
    await prisma.marketBar.createMany({
      data: [
        {
          symbolId,
          timeframe: 'h1',
          time: new Date('2026-03-17T08:00:00.000Z'),
          open: '64000',
          high: '64500',
          low: '63800',
          close: '64300',
          source: 'TEST',
        },
        {
          symbolId,
          timeframe: 'h1',
          time: new Date('2026-03-17T09:00:00.000Z'),
          open: '64300',
          high: '64600',
          low: '64200',
          close: '64500',
          source: 'TEST',
        },
      ],
    })

    await supertestRequest(app.getHttpServer())
      .get('/api/v1/market/bars')
      .query({ symbol: 'BTCUSDT', timeframe: '1h', limit: 10 })
      .expect(200)
      .expect((res) => {
        const payload = res.body.data ?? res.body
        expect(Array.isArray(payload)).toBe(true)
        expect(payload.length).toBe(2)
        expect(new Date(payload[0].time).getTime()).toBeLessThan(new Date(payload[1].time).getTime())
      })
  })
})
