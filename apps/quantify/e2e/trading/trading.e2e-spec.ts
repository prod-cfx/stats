import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { CreateOrderInput, ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { ExchangeAccountConfig, ExchangeAccountStore } from '@/modules/trading/factory/account-store'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { EnvModule } from '@/common/modules/env.module'
import { TradingModule } from '@/modules/trading/trading.module'
import { TradingService } from '@/modules/trading/trading.service'
import { PrismaService } from '@/prisma/prisma.service'

const hyperliquidExchangeClientMock = jest.fn()
const hyperliquidInfoClientMock = jest.fn()

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  InfoClient: hyperliquidInfoClientMock,
  ExchangeClient: hyperliquidExchangeClientMock,
}))

jest.mock('@nktkas/hyperliquid/utils', () => ({
  formatPrice: jest.fn((price: string | number) => String(price)),
  formatSize: jest.fn((size: string | number) => String(size)),
}))

jest.mock('ethers', () => ({
  Wallet: jest.fn().mockImplementation((privateKey: string) => ({ privateKey })),
}))

class InMemoryAccountStore implements ExchangeAccountStore {
  async getAccountConfig(userId: string, exchangeId: ExchangeId): Promise<ExchangeAccountConfig | null> {
    // 测试场景中忽略 userId，直接返回固定配置
    if (exchangeId === 'binance') {
      return {
        exchangeId: 'binance',
        config: {
          apiKey: 'test-api-key',
          secret: 'test-secret',
        },
      }
    }

    if (exchangeId === 'okx') {
      return {
        exchangeId: 'okx',
        config: {
          apiKey: 'test-api-key',
          secret: 'test-secret',
          passphrase: 'test-passphrase',
        },
      }
    }

    if (exchangeId === 'hyperliquid') {
      return {
        exchangeId: 'hyperliquid',
        config: {
          mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
          agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
          isTestnet: true,
        },
      }
    }

    return null
  }
}

describe('TradingService (E2E, trading module only)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let tradingService: TradingService

  const originalFetch = globalThis.fetch

  beforeAll(async () => {
    // 全局 mock fetch，拦截 Binance / OKX 请求，避免访问真实交易所
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)
      const method = (init?.method || 'GET').toUpperCase()

      // Binance 现货下单
      if (url.hostname === 'api.binance.com' && url.pathname === '/api/v3/order' && method === 'POST') {
        const body = {
          orderId: 123456,
          clientOrderId: 'test-binance-order',
          status: 'NEW',
          executedQty: '0',
          origQty: '0.001',
          price: '60000',
          updateTime: Date.now(),
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      // OKX 下单 ACK：真实回包通常只有 ordId/clOrdId/sCode/sMsg，不带完整订单状态
      if (url.hostname === 'www.okx.com' && url.pathname === '/api/v5/trade/order' && method === 'POST') {
        const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}

        if (
          rawBody.instId === 'BTC-USDT'
          && rawBody.ordType === 'market'
          && rawBody.side === 'buy'
          && rawBody.tgtCcy !== 'base_ccy'
        ) {
          const body = {
            data: [
              {
                ordId: '',
                clOrdId: '',
                sCode: '51020',
                sMsg: 'Your order should meet or exceed the minimum order amount.',
              },
            ],
          }
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        const body = {
          data: [
            {
              ordId: '987654',
              clOrdId: 'test-okx-order',
              sCode: '0',
              sMsg: '',
            },
          ],
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url.hostname === 'www.okx.com' && url.pathname === '/api/v5/public/instruments' && method === 'GET') {
        const body = {
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      // OKX 查询订单详情
      if (url.hostname === 'www.okx.com' && url.pathname === '/api/v5/trade/order' && method === 'GET') {
        const body = {
          data: [
            {
              ordId: '987654',
              clOrdId: 'test-okx-order',
              instId: 'BTC-USDT-SWAP',
              state: 'live',
              side: 'buy',
              ordType: 'limit',
              fillSz: '0',
              sz: '1',
              px: '60000',
              uTime: String(Date.now()),
              cTime: String(Date.now()),
            },
          ],
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      // 其他请求一律返回 200 空对象，避免干扰
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), EnvModule, TradingModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider('ExchangeAccountStore')
      .useClass(InMemoryAccountStore)
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    tradingService = app.get(TradingService)
  })

  beforeEach(() => {
    hyperliquidExchangeClientMock.mockReset()
    hyperliquidInfoClientMock.mockReset()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    globalThis.fetch = originalFetch
  })

  function makeOrderInput(symbol: string, marketType: MarketType): CreateOrderInput {
    return {
      symbol,
      marketType,
      side: 'buy',
      type: 'limit',
      amount: 0.001,
      price: 60000,
    }
  }

  it('places a spot order on Binance via TradingService', async () => {
    const userId = 'test-user'
    const exchangeId: ExchangeId = 'binance'
    const marketType: MarketType = 'spot'

    const order = await tradingService.placeOrder(userId, exchangeId, marketType, makeOrderInput('BTC/USDT', 'spot'))

    expect(order.id).toBe('123456')
    expect(order.clientOrderId).toBe('test-binance-order')
    expect(order.symbol).toBe('BTC/USDT')
    expect(order.marketType).toBe('spot')
    expect(order.side).toBe('buy')
    expect(order.type).toBe('limit')
    expect(order.amount).toBeCloseTo(0.001)
    expect(order.price).toBeCloseTo(60000)
    expect(order.status).toBe('open')
    expect(order.raw).toBeDefined()
  })

  it('places a perp order on OKX via TradingService', async () => {
    const userId = 'test-user'
    const exchangeId: ExchangeId = 'okx'
    const marketType: MarketType = 'perp'

    const order = await tradingService.placeOrder(userId, exchangeId, marketType, makeOrderInput('BTC/USDT:PERP', 'perp'))

    expect(order.id).toBe('987654')
    expect(order.clientOrderId).toBe('test-okx-order')
    expect(order.symbol).toBe('BTC/USDT:PERP')
    expect(order.marketType).toBe('perp')
    expect(order.side).toBe('buy')
    expect(order.type).toBe('limit')
    expect(order.amount).toBeCloseTo(0.001)
    expect(order.price).toBeCloseTo(60000)
    expect(order.status).toBe('open')
    expect(order.raw).toBeDefined()
  })

  it('places a spot market buy order on OKX via TradingService with base_ccy sizing', async () => {
    const userId = 'test-user'
    const exchangeId: ExchangeId = 'okx'
    const marketType: MarketType = 'spot'

    const order = await tradingService.placeOrder(userId, exchangeId, marketType, {
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      amount: 0.00134,
    })

    expect(order.id).toBe('987654')
    expect(order.symbol).toBe('BTC/USDT')
    expect(order.marketType).toBe('spot')
    expect(order.side).toBe('buy')
    expect(order.type).toBe('market')
    expect(order.amount).toBeCloseTo(0.00134)
    expect(order.status).toBe('open')
  })

  it('places a spot order on Hyperliquid via TradingService', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      status: 'ok',
      response: {
        data: {
          statuses: [
            {
              resting: {
                oid: 24680,
                cloid: '0x1234567890abcdef1234567890abcdef',
              },
            },
          ],
        },
      },
    })

    hyperliquidInfoClientMock.mockImplementation(() => ({
      allMids: jest.fn().mockResolvedValue({}),
      spotMeta: jest.fn().mockResolvedValue({
        universe: [
          { tokens: [0, 1], name: 'PURR/USDC', index: 7, isCanonical: true },
        ],
        tokens: [
          {
            name: 'PURR',
            szDecimals: 2,
            weiDecimals: 8,
            index: 0,
            tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
            isCanonical: true,
            evmContract: null,
            fullName: 'Purr',
            deployerTradingFeeShare: '0',
          },
          {
            name: 'USDC',
            szDecimals: 6,
            weiDecimals: 6,
            index: 1,
            tokenId: '0x0000000000000000000000000000000000000000000000000000000000000001',
            isCanonical: true,
            evmContract: null,
            fullName: 'USD Coin',
            deployerTradingFeeShare: '0',
          },
        ],
      }),
    }))
    hyperliquidExchangeClientMock.mockImplementation(() => ({
      order: orderMock,
    }))

    const userId = 'test-user'
    const exchangeId: ExchangeId = 'hyperliquid'
    const marketType: MarketType = 'spot'

    const order = await tradingService.placeOrder(userId, exchangeId, marketType, {
      symbol: 'PURR/USDC',
      marketType: 'spot',
      side: 'buy',
      type: 'limit',
      amount: 12.34,
      price: 0.42,
    })

    expect(order.id).toBe('24680')
    expect(order.symbol).toBe('PURR/USDC')
    expect(order.marketType).toBe('spot')
    expect(order.side).toBe('buy')
    expect(order.type).toBe('limit')
    expect(order.status).toBe('open')
    expect(order.raw).toBeDefined()
  })

  it('fetches OKX order details via TradingService after order acknowledgement', async () => {
    const userId = 'test-user'
    const exchangeId: ExchangeId = 'okx'
    const marketType: MarketType = 'perp'

    const order = await tradingService.getOrder(userId, exchangeId, marketType, '987654', 'BTC/USDT:PERP')

    expect(order.id).toBe('987654')
    expect(order.clientOrderId).toBe('test-okx-order')
    expect(order.symbol).toBe('BTC/USDT:PERP')
    expect(order.marketType).toBe('perp')
    expect(order.side).toBe('buy')
    expect(order.type).toBe('limit')
    expect(order.amount).toBeCloseTo(0.01)
    expect(order.price).toBeCloseTo(60000)
    expect(order.status).toBe('open')
  })
})
