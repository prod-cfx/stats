import type { INestApplication } from '@nestjs/common'
import { toMarketKey } from '@ai/shared'
import { RedisService } from '@/common/services/redis.service'

import { OrderbookWsSyncManager } from '@/modules/data-sync/services/orderbook-ws-sync-manager.service'
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { createTestingApp } from '../fixtures/fixtures'

// 通过环境变量控制是否实际访问 Binance WS，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.BINANCE_ORDERBOOK_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Binance orderbook WS via OrderbookWsSyncManager (E2E)', () => {
  let app: INestApplication
  let redisService: RedisService
  let orderbookConfigService: OrderbookPairConfigService
  let wsManager: OrderbookWsSyncManager

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
    wsManager = app.get(OrderbookWsSyncManager)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should subscribe/unsubscribe and create/delete Redis snapshots when configs change', async () => {
    const client = redisService.getClient()

    const marketKey = toMarketKey({
      base: BASE,
      quote: QUOTE,
      venueType: 'spot',
    })
    const redisKey = `orderbook:binance-spot:${marketKey}`

    // 0）清理 Redis 中遗留的快照
    await client.del(redisKey)

    // 1）记录当前 BINANCE SPOT BTCUSDT 配置原始状态，并确保测试开始时全部处于 disabled
    const pairId = `${SYMBOL}.${VENUE}.SPOT`
    const allConfigs = await orderbookConfigService.findAll({
      venue: VENUE,
      venueType: 'CEX',
      instrumentType: 'SPOT',
    })

    const existingForPair = allConfigs.filter(cfg => cfg.pairId === pairId)

    const originalStates = existingForPair.map(cfg => ({
      id: cfg.id,
      enabled: cfg.enabled,
    }))

    // 将所有已存在配置暂时禁用，避免影响"无配置"场景断言
    await Promise.all(
      existingForPair
        .filter(cfg => cfg.enabled)
        .map(cfg => orderbookConfigService.update(cfg.id, { enabled: false })),
    )

    const managerForTest = wsManager as unknown as { tick: () => Promise<void> }

    let createdConfigId: string | null = null

    try {
      // 2）运行一次 tick，此时不应产生任何 Binance WS snapshot
      await managerForTest.tick()
      const payload = await client.get(redisKey)
      expect(payload).toBeNull()

      // 3）动态添加/启用一条 BINANCE CEX SPOT BTCUSDT 配置
      const refreshedAll = await orderbookConfigService.findAll({
        venue: VENUE,
        venueType: 'CEX',
        instrumentType: 'SPOT',
      })
      let targetConfig =
        refreshedAll.find(
          (cfg) =>
            cfg.pairId === pairId &&
            cfg.venue.toUpperCase() === VENUE &&
            cfg.venueType === 'CEX' &&
            cfg.instrumentType === 'SPOT',
        ) ?? null

      if (!targetConfig) {
        try {
          const created = await orderbookConfigService.create({
            pairId,
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
            description: 'E2E: Binance BTCUSDT spot orderbook via manager',
            pullIntervalSeconds: null,
          })
          targetConfig = created
          createdConfigId = created.id
        } catch {
          const retryAll = await orderbookConfigService.findAll({
            venue: VENUE,
            venueType: 'CEX',
            instrumentType: 'SPOT',
          })
          targetConfig =
            retryAll.find(
              (cfg) =>
                cfg.pairId === pairId &&
                cfg.venue.toUpperCase() === VENUE &&
                cfg.venueType === 'CEX' &&
                cfg.instrumentType === 'SPOT',
            ) ?? null
        }
      }

      if (!targetConfig) {
        throw new Error('Failed to ensure BINANCE CEX SPOT BTCUSDT orderbook config exists (manager)')
      }

      if (!targetConfig.enabled) {
        targetConfig = await orderbookConfigService.update(targetConfig.id, {
          enabled: true,
        })
      }

      // 4）再次运行 tick，此时 manager 应该为该配置建立 WS 连接 + snapshot
      await managerForTest.tick()

      // 轮询 Redis，等待首个 snapshot
      const firstMaxAttempts = 10
      const intervalMs = 2000
      let firstPayload: string | null = null

      for (let i = 0; i < firstMaxAttempts; i += 1) {
        firstPayload = await client.get(redisKey)
        if (firstPayload) break
        await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
      }

      expect(firstPayload).toBeTruthy()

      // 5）动态关闭该配置（enabled=false），再次运行 tick，应删除 Redis snapshot
      await orderbookConfigService.update(targetConfig.id, { enabled: false })
      await managerForTest.tick()

      // 轮询 Redis，等待快照删除
      const deleteMaxAttempts = 10
      let deleted = false

      for (let i = 0; i < deleteMaxAttempts; i += 1) {
        const val = await client.get(redisKey)
        if (!val) {
          deleted = true
          break
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs))
      }

      expect(deleted).toBe(true)
    } finally {
      // 恢复数据库中该 pairId 的原始状态，避免影响共享环境
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
