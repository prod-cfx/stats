import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { toMarketKey } from '@ai/shared'
import { Test } from '@nestjs/testing'

import { RedisService } from '../src/common/services/redis.service'
import { AppModule } from '../src/modules/app.module'
import { BitmaxCexPerpetualOrderbookWsAdapter } from '../src/modules/data-sync/services/adapters/bitmax-cex-perpetual-orderbook-ws.adapter'
import { BitmaxCexSpotOrderbookWsAdapter } from '../src/modules/data-sync/services/adapters/bitmax-cex-spot-orderbook-ws.adapter'
import { OrderbookPairConfigService } from '../src/modules/orderbook-config/services/orderbook-pair-config.service'
import { ensureE2eEnv, ensureE2eDefaults } from './helpers/setup-e2e-env'

// 通过环境变量控制是否实际访问 Bitmax WS，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.BITMAX_ORDERBOOK_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Bitmax orderbook WS (E2E)', () => {
  let app: INestApplication
  let redisService: RedisService
  let orderbookConfigService: OrderbookPairConfigService
  let spotAdapter: BitmaxCexSpotOrderbookWsAdapter
  let perpAdapter: BitmaxCexPerpetualOrderbookWsAdapter

  const VENUE = 'BITMAX'
  const BASE = 'BTC'
  const QUOTE = 'USDT'

  const firstMaxAttempts = 10
  const updateMaxAttempts = 10
  const intervalMs = 2000

  jest.setTimeout(120_000)

  beforeAll(async () => {
    ensureE2eEnv()
    ensureE2eDefaults({ ORDERBOOK_WS_ENABLED: 'true' })

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    redisService = app.get(RedisService)
    orderbookConfigService = app.get(OrderbookPairConfigService)
    spotAdapter = app.get(BitmaxCexSpotOrderbookWsAdapter)
    perpAdapter = app.get(BitmaxCexPerpetualOrderbookWsAdapter)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  const runOrderbookWsTest = async (params: {
    symbol: string
    base: string
    quote: string
    instrumentType: 'SPOT' | 'PERPETUAL'
    venueId: string
    venueType: 'spot' | 'perp'
    adapter: BitmaxCexSpotOrderbookWsAdapter | BitmaxCexPerpetualOrderbookWsAdapter
    description: string
  }): Promise<void> => {
    const {
      symbol,
      base,
      quote,
      instrumentType,
      venueId,
      venueType,
      adapter,
      description,
    } = params

    const client = redisService.getClient()

    // 1）确保存在 BITMAX CEX 配置，并在测试结束后恢复原状态
    const allConfigs = await orderbookConfigService.findAll({
      venue: VENUE,
      venueType: 'CEX',
      instrumentType,
    })

    const normalizedSymbol = symbol.toUpperCase()
    const existingForSymbol = allConfigs.filter(cfg => cfg.symbol.toUpperCase() === normalizedSymbol)
    const originalStates = existingForSymbol.map(cfg => ({
      id: cfg.id,
      enabled: cfg.enabled,
    }))

    let targetConfig =
      existingForSymbol.find(cfg => cfg.enabled) ??
      existingForSymbol.find(cfg => !cfg.enabled) ??
      null

    let createdConfigId: string | null = null

    try {
      if (!targetConfig) {
        const targetPairId = `${normalizedSymbol}.${VENUE}.${instrumentType}`
        try {
          const created = await orderbookConfigService.create({
            pairId: targetPairId,
            venue: VENUE,
            symbol,
            baseAsset: base,
            quoteAsset: quote,
            venueType: 'CEX',
            instrumentType,
            enabled: true,
            depthLevels: 50,
            priority: 100,
            metadata: {},
            description,
            pullIntervalSeconds: null,
          })
          targetConfig = created
          createdConfigId = created.id
        } catch {
          // 并发创建失败或已存在时，重新查询
          const refreshed = await orderbookConfigService.findAll({
            venue: VENUE,
            venueType: 'CEX',
            instrumentType,
          })
          targetConfig =
            refreshed.find(cfg => cfg.symbol.toUpperCase() === normalizedSymbol) ?? null
        }
      }

      if (!targetConfig) {
        throw new Error(`Failed to ensure BITMAX CEX ${instrumentType} ${symbol} orderbook config exists`)
      }

      // 确保该配置处于启用状态
      if (!targetConfig.enabled) {
        targetConfig = await orderbookConfigService.update(targetConfig.id, {
          enabled: true,
        })
      }

      // 2）通过 WS 适配器建立连接并同步订阅
      await adapter.ensureConnected()
      await adapter.syncTargetConfigs([targetConfig])

      const marketKey = toMarketKey({
        base,
        quote,
        venueType,
      })
      const redisKey = `orderbook:${venueId}:${marketKey}`

      // 3）轮询 Redis，确认首次 snapshot/更新已经写入
      let firstPayload: string | null = null

      for (let i = 0; i < firstMaxAttempts; i += 1) {
        firstPayload = await client.get(redisKey)
        if (firstPayload) break
        await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
      }

      expect(firstPayload).toBeTruthy()

      const firstParsed = JSON.parse(firstPayload as string) as {
        venueId: string
        marketKey: string
        bids: { price: number; size: number }[]
        asks: { price: number; size: number }[]
        version: number
        receivedTs: number
      }

      expect(firstParsed.venueId).toBe(venueId)
      expect(firstParsed.marketKey).toBe(marketKey)
      expect(Array.isArray(firstParsed.bids)).toBe(true)
      expect(Array.isArray(firstParsed.asks)).toBe(true)
      expect(firstParsed.bids.length).toBeGreaterThan(0)
      expect(firstParsed.asks.length).toBeGreaterThan(0)

      const initialVersion = firstParsed.version
      const initialReceivedTs = firstParsed.receivedTs

      // 4）继续轮询，确认版本号或时间戳发生变化，证明 WS diff 在持续更新
      let updated = false

      for (let i = 0; i < updateMaxAttempts; i += 1) {
        const payload = await client.get(redisKey)
        if (payload) {
          const parsed = JSON.parse(payload) as typeof firstParsed
          if (
            parsed.version !== initialVersion ||
            parsed.receivedTs !== initialReceivedTs
          ) {
            updated = true
            break
          }
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
      }

      expect(updated).toBe(true)
    } finally {
      // 恢复数据库中该 symbol 的原始 enabled 状态，并删除测试期间新建的配置
      if (createdConfigId) {
        await orderbookConfigService.delete(createdConfigId)
      }

      if (originalStates.length) {
        await Promise.all(
          originalStates.map(state =>
            orderbookConfigService.update(state.id, { enabled: state.enabled }),
          ),
        )
      }
    }
  }

  describe('SPOT', () => {
    it('should establish Bitmax SPOT WS and continuously update orderbook in Redis', async () => {
      await runOrderbookWsTest({
        symbol: 'BTC/USDT',
        base: BASE,
        quote: QUOTE,
        instrumentType: 'SPOT',
        venueId: 'bitmax-spot',
        venueType: 'spot',
        adapter: spotAdapter,
        description: 'E2E: Bitmax BTC/USDT spot orderbook WS',
      })
    })
  })

  describe('PERPETUAL', () => {
    it('should establish Bitmax PERPETUAL WS and continuously update orderbook in Redis', async () => {
      await runOrderbookWsTest({
        symbol: 'BTC-PERP',
        base: BASE,
        quote: QUOTE,
        instrumentType: 'PERPETUAL',
        venueId: 'bitmax-perp',
        venueType: 'perp',
        adapter: perpAdapter,
        description: 'E2E: Bitmax BTC-PERP perpetual orderbook WS',
      })
    })
  })
})
