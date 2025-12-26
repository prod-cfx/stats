import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { resolve } from 'node:path'
import { toMarketKey } from '@ai/shared'
import { Test } from '@nestjs/testing'

import { RedisService } from '../src/common/services/redis.service'
import { AppModule } from '../src/modules/app.module'
import { BinanceOrderBookSnapshotJob } from '../src/modules/data-sync/jobs/binance-orderbook-snapshot.job'
import { DataPullTaskRepository } from '../src/modules/data-sync/repositories/data-pull-task.repository'
import { OrderbookPairConfigService } from '../src/modules/orderbook-config/services/orderbook-pair-config.service'

// 通过环境变量控制是否实际访问 Binance，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.BINANCE_ORDERBOOK_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Binance orderbook snapshot (E2E)', () => {
  let app: INestApplication
  let redisService: RedisService
  let taskRepo: DataPullTaskRepository
  let orderbookConfigService: OrderbookPairConfigService
  let snapshotJob: BinanceOrderBookSnapshotJob

  const TASK_KEY = 'binance-orderbook-snapshot'
  const SYMBOL = 'BTCUSDT'
  const BASE = 'BTC'
  const QUOTE = 'USDT'
  const VENUE = 'BINANCE'

  beforeAll(async () => {
    // 确保使用 e2e 环境配置（.env.e2e / .env.e2e.local）
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    redisService = app.get(RedisService)
    taskRepo = app.get(DataPullTaskRepository)
    orderbookConfigService = app.get(OrderbookPairConfigService)
    snapshotJob = app.get(BinanceOrderBookSnapshotJob)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should fetch Binance spot orderbook snapshot and store into Redis', async () => {
    const client = redisService.getClient()

    // 1）确保存在至少一个 BINANCE CEX SPOT 的订单簿配置（无论是否已启用）
    const targetPairId = `${SYMBOL}.${VENUE}.SPOT`
    const allConfigs = await orderbookConfigService.findAll({
      venue: VENUE,
      venueType: 'CEX',
      instrumentType: 'SPOT',
    })

    let targetConfig =
      allConfigs.find((cfg) => cfg.pairId === targetPairId) ?? null

    if (!targetConfig) {
      try {
        targetConfig = await orderbookConfigService.create({
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
          description: 'E2E: Binance BTCUSDT spot orderbook',
          pullIntervalSeconds: null,
        })
      } catch {
        // 如果并发创建失败或已存在，重新查询一次获取最终配置
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
    }

    // 2）确保存在对应的数据拉取任务（data_pull_tasks）
    const existingTask = await taskRepo.findByKey(TASK_KEY)
    if (!existingTask) {
      await taskRepo.createTask({
        key: TASK_KEY,
        name: 'E2E: Binance spot orderbook snapshot',
        source: 'binance',
        type: 'orderbook_snapshot',
        // intervalSeconds 为空表示始终 due，由统一 Cron 控制频率
        intervalSeconds: null,
        enabled: true,
        cursor: null,
        cron: null,
      })
    } else if (!existingTask.enabled || existingTask.intervalSeconds !== null) {
      await taskRepo.updateTask(existingTask.id, {
        enabled: true,
        intervalSeconds: null,
      })
    }

    // 3）直接执行 BinanceOrderBookSnapshotJob，便于在测试中看到详细 meta 信息
    const jobResult = await snapshotJob.run(null)
    // 在测试输出中打印 meta，方便排查失败原因
    console.log('BinanceOrderBookSnapshotJob result:', jobResult)

    if (!jobResult.fetchedCount) {
      throw new Error(
        `BinanceOrderBookSnapshotJob fetched 0 books, meta=${JSON.stringify(jobResult.meta ?? {}, null, 2)}`,
      )
    }

    // 4）检查 Redis 中是否写入了对应的订单簿快照
    const marketKey = toMarketKey({
      base: BASE,
      quote: QUOTE,
      venueType: 'spot',
    })

    const redisKey = `orderbook:binance-spot:${marketKey}`

    // 简单重试几次，给 Binance API 和 Redis 一点缓冲时间
    const maxAttempts = 5
    const delayMs = 2000

    let payload: string | null = null
    for (let i = 0; i < maxAttempts; i += 1) {
      payload = await client.get(redisKey)
      if (payload) break
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs))
    }

    expect(payload).toBeTruthy()

    const parsed = JSON.parse(payload as string) as {
      venueId: string
      marketKey: string
      bids: { price: number; size: number }[]
      asks: { price: number; size: number }[]
      version: number
    }

    expect(parsed.venueId).toBe('binance-spot')
    expect(parsed.marketKey).toBe(marketKey)
    expect(Array.isArray(parsed.bids)).toBe(true)
    expect(Array.isArray(parsed.asks)).toBe(true)
    expect(parsed.bids.length).toBeGreaterThan(0)
    expect(parsed.asks.length).toBeGreaterThan(0)
    expect(typeof parsed.version).toBe('number')
  })
})

