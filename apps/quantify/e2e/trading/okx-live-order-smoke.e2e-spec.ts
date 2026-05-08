/**
 * Explicit live command:
 * QUANTIFY_OKX_LIVE_ORDER_SMOKE=true \
 * QUANTIFY_OKX_LIVE_ORDER_USER_ID=<user-id> \
 * QUANTIFY_OKX_LIVE_ORDER_ACCOUNT_ID=<okx-exchange-account-id> \
 * QUANTIFY_OKX_LIVE_ORDER_SYMBOL=BTC/USDT \
 * QUANTIFY_OKX_LIVE_ORDER_LIMIT_PRICE=<far-below-market-limit-price> \
 * QUANTIFY_OKX_LIVE_ORDER_MAX_NOTIONAL=<quote-notional-up-to-5> \
 * QUANTIFY_OKX_LIVE_ORDER_MAX_LIMIT_PRICE_TO_LAST_RATIO=0.5 \
 * dx test e2e quantify apps/quantify/e2e/trading/okx-live-order-smoke.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { CreateOrderInput } from '@/modules/trading/core/types'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { TradingModule } from '@/modules/trading/trading.module'
import { TradingService } from '@/modules/trading/trading.service'

const LIVE_SMOKE_ENABLED = process.env.QUANTIFY_OKX_LIVE_ORDER_SMOKE === 'true'
const ALLOWED_SYMBOLS = new Set(['BTC/USDT', 'ETH/USDT'])
const MAX_ALLOWED_NOTIONAL = 5
const DEFAULT_MAX_LIMIT_PRICE_TO_LAST_RATIO = 0.5

interface LiveOrderSmokeConfig {
  userId: string
  accountId: string
  symbol: 'BTC/USDT' | 'ETH/USDT'
  limitPrice: number
  maxNotional: number
  maxLimitPriceToLastRatio: number
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required when QUANTIFY_OKX_LIVE_ORDER_SMOKE=true`)
  }
  return value
}

function readPositiveNumberEnv(name: string): number {
  const raw = readRequiredEnv(name)
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than 0`)
  }
  return value
}

function readLiveOrderSmokeConfig(): LiveOrderSmokeConfig {
  const symbol = readRequiredEnv('QUANTIFY_OKX_LIVE_ORDER_SYMBOL')
  if (!ALLOWED_SYMBOLS.has(symbol)) {
    throw new Error('QUANTIFY_OKX_LIVE_ORDER_SYMBOL must be BTC/USDT or ETH/USDT')
  }

  const maxNotional = readPositiveNumberEnv('QUANTIFY_OKX_LIVE_ORDER_MAX_NOTIONAL')
  if (maxNotional > MAX_ALLOWED_NOTIONAL) {
    throw new Error('QUANTIFY_OKX_LIVE_ORDER_MAX_NOTIONAL must be less than or equal to 5')
  }

  const maxLimitPriceToLastRatio = process.env.QUANTIFY_OKX_LIVE_ORDER_MAX_LIMIT_PRICE_TO_LAST_RATIO?.trim()
    ? readPositiveNumberEnv('QUANTIFY_OKX_LIVE_ORDER_MAX_LIMIT_PRICE_TO_LAST_RATIO')
    : DEFAULT_MAX_LIMIT_PRICE_TO_LAST_RATIO
  if (maxLimitPriceToLastRatio > DEFAULT_MAX_LIMIT_PRICE_TO_LAST_RATIO) {
    throw new Error('QUANTIFY_OKX_LIVE_ORDER_MAX_LIMIT_PRICE_TO_LAST_RATIO must be less than or equal to 0.5')
  }

  return {
    userId: readRequiredEnv('QUANTIFY_OKX_LIVE_ORDER_USER_ID'),
    accountId: readRequiredEnv('QUANTIFY_OKX_LIVE_ORDER_ACCOUNT_ID'),
    symbol: symbol as LiveOrderSmokeConfig['symbol'],
    limitPrice: readPositiveNumberEnv('QUANTIFY_OKX_LIVE_ORDER_LIMIT_PRICE'),
    maxNotional,
    maxLimitPriceToLastRatio,
  }
}

function buildLimitBuyOrderInput(config: LiveOrderSmokeConfig): CreateOrderInput {
  return {
    symbol: config.symbol,
    marketType: 'spot',
    side: 'buy',
    type: 'limit',
    amount: config.maxNotional / config.limitPrice,
    price: config.limitPrice,
    timeInForce: 'GTC',
    clientOrderId: `qokxsmoke${Date.now()}`,
  }
}

async function assertLimitPriceIsNonMarketable(
  tradingService: TradingService,
  config: LiveOrderSmokeConfig,
): Promise<void> {
  const ticker = await tradingService.getTicker(config.userId, 'okx', 'spot', config.symbol, config.accountId)
  const lastPrice = ticker.last
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
    throw new Error(`OKX ticker last price is invalid for ${config.symbol}`)
  }

  const maxAllowedLimitPrice = lastPrice * config.maxLimitPriceToLastRatio
  if (config.limitPrice > maxAllowedLimitPrice) {
    throw new Error(
      `QUANTIFY_OKX_LIVE_ORDER_LIMIT_PRICE must be <= ${config.maxLimitPriceToLastRatio * 100}% `
      + `of current OKX last price (${lastPrice}) to avoid marketable live smoke orders`,
    )
  }
}

describe('OKX live order smoke (opt-in)', () => {
  let app: INestApplication | undefined
  let moduleFixture: TestingModule | undefined
  let tradingService: TradingService | undefined
  let config: LiveOrderSmokeConfig | undefined

  beforeAll(async () => {
    if (!LIVE_SMOKE_ENABLED) {
      return
    }

    config = readLiveOrderSmokeConfig()

    moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot(), EnvModule, ClsConfigModule, TradingModule],
    })
      .overrideProvider(MarketDataIngestionService)
      .useValue({
        onModuleInit: () => {},
        onModuleDestroy: () => {},
        handleGapFill: () => {},
        handleDynamicSymbolRefresh: () => {},
        ensureSymbolsSubscribed: async () => {},
      })
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    tradingService = app.get(TradingService)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('passes closed without initializing live order dependencies unless explicitly enabled', () => {
    if (LIVE_SMOKE_ENABLED) {
      return
    }

    expect(app).toBeUndefined()
    expect(moduleFixture).toBeUndefined()
    expect(tradingService).toBeUndefined()
  })

  it('places a guarded OKX spot limit buy and cancels it', async () => {
    if (!LIVE_SMOKE_ENABLED) {
      return
    }

    if (!config || !tradingService) {
      throw new Error('Live OKX smoke dependencies were not initialized')
    }

    await assertLimitPriceIsNonMarketable(tradingService, config)

    const input = buildLimitBuyOrderInput(config)
    let orderId: string | undefined

    try {
      const order = await tradingService.placeOrder(
        config.userId,
        'okx',
        'spot',
        input,
        config.accountId,
      )

      orderId = order.id

      expect(order.id).toBeTruthy()
      expect(order.clientOrderId).toBe(input.clientOrderId)
      expect(order.symbol).toBe(config.symbol)
      expect(order.marketType).toBe('spot')
      expect(order.side).toBe('buy')
      expect(order.type).toBe('limit')
      expect(order.price).toBeLessThanOrEqual(config.limitPrice)
      expect(order.amount * config.limitPrice).toBeLessThanOrEqual(MAX_ALLOWED_NOTIONAL)
    }
    finally {
      if (orderId) {
        await tradingService.cancelOrder(config.userId, 'okx', 'spot', orderId, config.symbol, config.accountId)
      }
    }
  })
})
