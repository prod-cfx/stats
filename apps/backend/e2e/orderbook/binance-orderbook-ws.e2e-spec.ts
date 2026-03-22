import type { INestApplication } from '@nestjs/common'
import { toMarketKey } from '@ai/shared'
import { RedisService } from '@/common/services/redis.service'

import { BinanceCexSpotOrderbookWsAdapter } from '@/modules/data-sync/services/adapters/binance-cex-spot-orderbook-ws.adapter'
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { createTestingApp } from '../fixtures/fixtures'

// 通过环境变量控制是否实际访问 Binance WS，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.BINANCE_ORDERBOOK_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Binance orderbook WS (E2E)', () => {
  let app: INestApplication
  let redisService: RedisService
  let orderbookConfigService: OrderbookPairConfigService
  let wsAdapter: BinanceCexSpotOrderbookWsAdapter

  const SYMBOL = 'BTCUSDT'
  const BASE = 'BTC'
  const QUOTE = 'USDT'
  const VENUE = 'BINANCE'

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { ORDERBOOK_WS_ENABLED: 'true' },
    })
    app = ctx.app

    redisService = app.get(RedisService)
    orderbookConfigService = app.get(OrderbookPairConfigService)
    wsAdapter = app.get(BinanceCexSpotOrderbookWsAdapter)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should establish Binance WS and continuously update orderbook in Redis', async () => {
    const client = redisService.getClient()

    // 1）确保存在 BINANCE CEX SPOT 的订单簿配置，并在测试结束后恢复原状态
    const targetPairId = `${SYMBOL}.${VENUE}.SPOT`
    const allConfigs = await orderbookConfigService.findAll({
      venue: VENUE,
      venueType: 'CEX',
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
    const modifiedConfigIds: string[] = []

    try {
      if (!targetConfig) {
        try {
          const created = await orderbookConfigService.create({
            pairId: targetPairId,
            venue: VENUE,
            symbol: SYMBOL,
            baseAsset: BASE,
            quoteAsset: QUOTE,
            venueType: 'CEX',
            instrumentType: 'SPOT',
            enabled: true,
            depthLevels: 50,
            priority: 100,
            metadata: {},
            description: 'E2E: Binance BTCUSDT spot orderbook WS',
            pullIntervalSeconds: null,
          })
          targetConfig = created
          createdConfigId = created.id
        } catch {
          // 并发创建失败或已存在时，重新查询
          const refreshed = await orderbookConfigService.findAll({
            venue: VENUE,
            venueType: 'CEX',
            instrumentType: 'SPOT',
          })
          targetConfig =
            refreshed.find((cfg) => cfg.pairId === targetPairId) ?? null
        }
      }

      if (!targetConfig) {
        throw new Error('Failed to ensure BINANCE CEX SPOT BTCUSDT orderbook config exists')
      }

      // 确保该配置处于启用状态
      if (!targetConfig.enabled) {
        targetConfig = await orderbookConfigService.update(targetConfig.id, {
          enabled: true,
        })
        modifiedConfigIds.push(targetConfig.id)
      }

      // 2）通过 WS 适配器建立连接并同步订阅
      await wsAdapter.ensureConnected()
      await wsAdapter.syncTargetConfigs([targetConfig])

      const marketKey = toMarketKey({
        base: BASE,
        quote: QUOTE,
        venueType: 'spot',
      })
      const redisKey = `orderbook:binance-spot:${marketKey}`

      // 3）轮询 Redis，确认首次 snapshot/更新已经写入
      const firstMaxAttempts = 10
      const intervalMs = 2000

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

      expect(firstParsed.venueId).toBe('binance-spot')
      expect(firstParsed.marketKey).toBe(marketKey)
      expect(Array.isArray(firstParsed.bids)).toBe(true)
      expect(Array.isArray(firstParsed.asks)).toBe(true)
      expect(firstParsed.bids.length).toBeGreaterThan(0)
      expect(firstParsed.asks.length).toBeGreaterThan(0)

      const initialVersion = firstParsed.version
      const initialReceivedTs = firstParsed.receivedTs

      // 4）继续轮询，确认版本号或时间戳发生变化，证明 WS diff 在持续更新
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
        await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
      }

      expect(updated).toBe(true)
    } finally {
      // 恢复数据库中该 pairId 的原始 enabled 状态，并删除测试期间新建的配置
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
