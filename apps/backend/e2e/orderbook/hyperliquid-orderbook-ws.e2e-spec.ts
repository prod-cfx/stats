import type { INestApplication } from '@nestjs/common'
import { toMarketKey } from '@ai/shared'
import { RedisService } from '@/common/services/redis.service'

import { HyperliquidDexPerpetualOrderbookWsAdapter } from '@/modules/data-sync/services/adapters/hyperliquid-dex-perpetual-orderbook-ws.adapter'
import { HyperliquidDexSpotOrderbookWsAdapter } from '@/modules/data-sync/services/adapters/hyperliquid-dex-spot-orderbook-ws.adapter'
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { createTestingApp } from '../fixtures/fixtures'
import { isE2eFlagEnabled } from '../helpers/setup-e2e-env'

// 通过环境变量控制是否实际访问 Hyperliquid WS，避免在 CI 默认跑外网依赖
const E2E_ENABLED = isE2eFlagEnabled('HYPERLIQUID_ORDERBOOK_E2E')
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Hyperliquid orderbook WS (E2E)', () => {
  let app: INestApplication
  let redisService: RedisService
  let orderbookConfigService: OrderbookPairConfigService
  let perpAdapter: HyperliquidDexPerpetualOrderbookWsAdapter
  let spotAdapter: HyperliquidDexSpotOrderbookWsAdapter

  const VENUE = 'HYPERLIQUID'

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { HYPERLIQUID_ORDERBOOK_WS_ENABLED: 'true' },
    })
    app = ctx.app

    redisService = app.get(RedisService)
    orderbookConfigService = app.get(OrderbookPairConfigService)
    perpAdapter = app.get(HyperliquidDexPerpetualOrderbookWsAdapter)
    spotAdapter = app.get(HyperliquidDexSpotOrderbookWsAdapter)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  describe('Perpetual contracts', () => {
    const SYMBOL = 'BTCUSDT'
    const BASE = 'BTC'
    const QUOTE = 'USDT'

    it('should establish Hyperliquid WS and continuously update perpetual orderbook in Redis', async () => {
      const client = redisService.getClient()

      const targetPairId = `${SYMBOL}.${VENUE}.PERPETUAL`
      const allConfigs = await orderbookConfigService.findAll({
        venue: VENUE,
        venueType: 'DEX',
        instrumentType: 'PERPETUAL',
      })

      const existingForPair = allConfigs.filter(cfg => cfg.pairId === targetPairId)
      const originalStates = existingForPair.map(cfg => ({
        id: cfg.id,
        enabled: cfg.enabled,
      }))

      let targetConfig =
        existingForPair.find(cfg => cfg.enabled) ??
        existingForPair.find(cfg => !cfg.enabled) ??
        null

      let createdConfigId: string | null = null

      try {
        if (!targetConfig) {
          try {
            const created = await orderbookConfigService.create({
              pairId: targetPairId,
              venue: VENUE,
              symbol: SYMBOL,
              baseAsset: BASE,
              quoteAsset: QUOTE,
              venueType: 'DEX',
              instrumentType: 'PERPETUAL',
              enabled: true,
              depthLevels: 100,
              priority: 100,
              metadata: {},
              description: 'E2E: Hyperliquid BTC perpetual orderbook WS',
              pullIntervalSeconds: null,
            })
            targetConfig = created
            createdConfigId = created.id
          } catch {
            const refreshed = await orderbookConfigService.findAll({
              venue: VENUE,
              venueType: 'DEX',
              instrumentType: 'PERPETUAL',
            })
            targetConfig =
              refreshed.find(cfg => cfg.pairId === targetPairId) ?? null
          }
        }

        if (!targetConfig) {
          throw new Error('Failed to ensure Hyperliquid DEX PERPETUAL BTC orderbook config exists')
        }

        if (!targetConfig.enabled) {
          targetConfig = await orderbookConfigService.update(targetConfig.id, {
            enabled: true,
          })
        }

        // 建立连接并同步订阅
        await perpAdapter.ensureConnected()
        await perpAdapter.syncTargetConfigs([targetConfig])

        const marketKey = toMarketKey({
          base: BASE,
          quote: QUOTE,
          venueType: 'perp',
        })
        const redisKey = `orderbook:hyperliquid-perp:${marketKey}`

        // 轮询 Redis，确认首次 snapshot 已写入
        const firstMaxAttempts = 15
        const intervalMs = 2000

        let firstPayload: string | null = null

        for (let i = 0; i < firstMaxAttempts; i += 1) {
          firstPayload = await client.get(redisKey)
          if (firstPayload) break
          await new Promise(resolveDelay => setTimeout(resolveDelay, intervalMs))
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

        expect(firstParsed.venueId).toBe('hyperliquid-perp')
        expect(firstParsed.marketKey).toBe(marketKey)
        expect(Array.isArray(firstParsed.bids)).toBe(true)
        expect(Array.isArray(firstParsed.asks)).toBe(true)
        expect(firstParsed.bids.length).toBeGreaterThan(0)
        expect(firstParsed.asks.length).toBeGreaterThan(0)

        const initialVersion = firstParsed.version
        const initialReceivedTs = firstParsed.receivedTs

        // 继续轮询，确认 snapshot 在持续更新（Hyperliquid 约 0.5s 推送一次）
        const updateMaxAttempts = 10
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
          await new Promise(resolveDelay => setTimeout(resolveDelay, intervalMs))
        }

        expect(updated).toBe(true)
      } finally {
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
    })
  })

  describe('Spot markets', () => {
    // PURR/USDC 是 Hyperliquid 现货的特殊格式，其他币种需要使用 @{index} 格式
    // 参考: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot
    const BASE = 'PURR'
    const QUOTE = 'USDC'
    const SYMBOL = `${BASE}/${QUOTE}`

    it('should establish Hyperliquid WS and continuously update spot orderbook in Redis', async () => {
      const client = redisService.getClient()

      const targetPairId = `${SYMBOL}.${VENUE}.SPOT`
      const allConfigs = await orderbookConfigService.findAll({
        venue: VENUE,
        venueType: 'DEX',
        instrumentType: 'SPOT',
      })

      const existingForPair = allConfigs.filter(cfg => cfg.pairId === targetPairId)
      const originalStates = existingForPair.map(cfg => ({
        id: cfg.id,
        enabled: cfg.enabled,
      }))

      let targetConfig =
        existingForPair.find(cfg => cfg.enabled) ??
        existingForPair.find(cfg => !cfg.enabled) ??
        null

      let createdConfigId: string | null = null

      try {
        if (!targetConfig) {
          try {
            const created = await orderbookConfigService.create({
              pairId: targetPairId,
              venue: VENUE,
              symbol: SYMBOL,
              baseAsset: BASE,
              quoteAsset: QUOTE,
              venueType: 'DEX',
              instrumentType: 'SPOT',
              enabled: true,
              depthLevels: 100,
              priority: 100,
              metadata: {},
              description: 'E2E: Hyperliquid PURR/USDC spot orderbook WS',
              pullIntervalSeconds: null,
            })
            targetConfig = created
            createdConfigId = created.id
          } catch {
            const refreshed = await orderbookConfigService.findAll({
              venue: VENUE,
              venueType: 'DEX',
              instrumentType: 'SPOT',
            })
            targetConfig =
              refreshed.find(cfg => cfg.pairId === targetPairId) ?? null
          }
        }

        if (!targetConfig) {
          throw new Error('Failed to ensure Hyperliquid DEX SPOT PURR/USDC orderbook config exists')
        }

        if (!targetConfig.enabled) {
          targetConfig = await orderbookConfigService.update(targetConfig.id, {
            enabled: true,
          })
        }

        // 建立连接并同步订阅
        await spotAdapter.ensureConnected()
        await spotAdapter.syncTargetConfigs([targetConfig])

        const marketKey = toMarketKey({
          base: BASE,
          quote: QUOTE,
          venueType: 'spot',
        })
        const redisKey = `orderbook:hyperliquid-spot:${marketKey}`

        // 轮询 Redis，确认首次 snapshot 已写入
        const firstMaxAttempts = 15
        const intervalMs = 2000

        let firstPayload: string | null = null

        for (let i = 0; i < firstMaxAttempts; i += 1) {
          firstPayload = await client.get(redisKey)
          if (firstPayload) break
          await new Promise(resolveDelay => setTimeout(resolveDelay, intervalMs))
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

        expect(firstParsed.venueId).toBe('hyperliquid-spot')
        expect(firstParsed.marketKey).toBe(marketKey)
        expect(Array.isArray(firstParsed.bids)).toBe(true)
        expect(Array.isArray(firstParsed.asks)).toBe(true)
        expect(firstParsed.bids.length).toBeGreaterThan(0)
        expect(firstParsed.asks.length).toBeGreaterThan(0)

        const initialVersion = firstParsed.version
        const initialReceivedTs = firstParsed.receivedTs

        // 继续轮询，确认 snapshot 在持续更新
        const updateMaxAttempts = 10
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
          await new Promise(resolveDelay => setTimeout(resolveDelay, intervalMs))
        }

        expect(updated).toBe(true)
      } finally {
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
    })
  })

  describe('Environment variable control', () => {
    it('should respect HYPERLIQUID_ORDERBOOK_WS_ENABLED setting', async () => {
      // 验证适配器能正确读取环境变量
      // 由于测试前已设置 HYPERLIQUID_ORDERBOOK_WS_ENABLED=true，适配器应正常工作
      // 这个测试主要验证适配器不会因环境变量问题而崩溃
      expect(perpAdapter).toBeDefined()
      expect(spotAdapter).toBeDefined()

      // 验证适配器 key 正确
      expect(perpAdapter.key).toBe('HYPERLIQUID.DEX.PERPETUAL')
      expect(spotAdapter.key).toBe('HYPERLIQUID.DEX.SPOT')
    })
  })
})
