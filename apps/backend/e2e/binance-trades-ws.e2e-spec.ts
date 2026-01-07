import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/modules/app.module'
import { BinanceCexSpotTradesWsAdapter } from '../src/modules/data-sync/services/adapters/binance-cex-spot-trades-ws.adapter'
import { MarketTradesRepository } from '../src/modules/markets/repositories/market-trades.repository'
import { TradesPairConfigService } from '../src/modules/trades-config/services/trades-pair-config.service'
import { PrismaService } from '../src/prisma/prisma.service'

// 通过环境变量控制是否实际访问 Binance WS，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.BINANCE_TRADES_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Binance trades WS (E2E)', () => {
  let app: INestApplication
  let tradesConfigService: TradesPairConfigService
  let marketTradesRepository: MarketTradesRepository
  let prisma: PrismaService
  let wsAdapter: BinanceCexSpotTradesWsAdapter

  const SYMBOL = 'BTCUSDT'
  const BASE = 'BTC'
  const QUOTE = 'USDT'
  const EXCHANGE = 'BINANCE'

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

    tradesConfigService = app.get(TradesPairConfigService)
    marketTradesRepository = app.get(MarketTradesRepository)
    prisma = app.get(PrismaService)
    wsAdapter = app.get(BinanceCexSpotTradesWsAdapter)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should establish Binance trades WS and insert trades into market_trades', async () => {
    // 0）如果当前数据库还没有 market_trades 表（例如 e2e DB 尚未执行最新迁移），则跳过本用例
    try {
      await prisma.marketTrade.count({
        where: {
          exchange: EXCHANGE,
          instrumentType: 'SPOT',
          symbol: SYMBOL,
        },
      })
    } catch (error: any) {
      if (typeof error?.message === 'string' && error.message.includes('does not exist')) {
        // eslint-disable-next-line no-console
        console.warn(
          '[Binance trades E2E] skip: table "market_trades" does not exist in current database, please run DB migrations for e2e env to enable this test.',
        )
        return
      }
      throw error
    }

    // 1）清理该交易对在 BINANCE SPOT 下的历史成交，避免脏数据影响断言
    await prisma.marketTrade.deleteMany({
      where: {
        exchange: EXCHANGE,
        instrumentType: 'SPOT',
        symbol: SYMBOL,
      },
    })

    // 2）确保存在 BINANCE SPOT BTCUSDT 的 Trades 配置，并在测试结束后恢复原状态
    const pairId = `${SYMBOL}.${EXCHANGE}.SPOT`
    const allConfigs = await tradesConfigService.findAll({
      exchange: EXCHANGE,
      instrumentType: 'SPOT',
    })

    const existingForPair = allConfigs.filter(cfg => cfg.pairId === pairId)
    const originalStates = existingForPair.map(cfg => ({
      id: cfg.id,
      enabled: cfg.enabled,
      metadata: cfg.metadata,
    }))

    let targetConfig =
      existingForPair.find(cfg => cfg.enabled) ??
      existingForPair.find(cfg => !cfg.enabled) ??
      null

    let createdConfigId: string | null = null

    try {
      if (!targetConfig) {
        try {
          const created = await tradesConfigService.create({
            pairId,
            exchange: EXCHANGE,
            symbol: SYMBOL,
            baseAsset: BASE,
            quoteAsset: QUOTE,
            instrumentType: 'SPOT',
            enabled: true,
            priority: 100,
            metadata: {
              binanceSymbol: SYMBOL,
            },
            description: 'E2E: Binance BTCUSDT spot trades WS',
          })
          targetConfig = created
          createdConfigId = created.id
        } catch {
          const refreshed = await tradesConfigService.findAll({
            exchange: EXCHANGE,
            instrumentType: 'SPOT',
          })
          targetConfig =
            refreshed.find(cfg => cfg.pairId === pairId) ?? null
        }
      }

      if (!targetConfig) {
        throw new Error('Failed to ensure BINANCE SPOT BTCUSDT trades config exists')
      }

      // 确保该配置处于启用状态，并包含 binanceSymbol 元数据，方便适配器解析 symbol
      let metadata = targetConfig.metadata ?? {}
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        metadata = {}
      }
      if (metadata.binanceSymbol == null) {
        metadata.binanceSymbol = SYMBOL
        targetConfig = await tradesConfigService.update(targetConfig.id, {
          metadata,
        })
      } else if (metadata.binanceSymbol !== SYMBOL) {
        // 避免测试期间误用其他 symbol
        metadata.binanceSymbol = SYMBOL
        targetConfig = await tradesConfigService.update(targetConfig.id, {
          metadata,
        })
      }

      if (!targetConfig.enabled) {
        targetConfig = await tradesConfigService.update(targetConfig.id, {
          enabled: true,
        })
      }

      const tradesConfig = {
        exchange: targetConfig.exchange,
        instrumentType: targetConfig.instrumentType as 'SPOT',
        symbol: targetConfig.symbol,
        baseAsset: targetConfig.baseAsset,
        quoteAsset: targetConfig.quoteAsset,
        enabled: targetConfig.enabled,
        priority: targetConfig.priority,
        metadata: targetConfig.metadata ?? undefined,
      }

      // 3）通过 WS 适配器建立连接并同步订阅
      await wsAdapter.ensureConnected()
      await wsAdapter.syncTargetConfigs([tradesConfig])

      // 4）轮询数据库，确认成交记录已写入
      const maxAttempts = 15
      const intervalMs = 2000
      let tradesCount = 0

      for (let i = 0; i < maxAttempts; i += 1) {
        const trades = await marketTradesRepository.findLatestTrades(
          EXCHANGE,
          'SPOT',
          SYMBOL,
          10,
        )
        tradesCount = trades.length
        if (tradesCount > 0) break
        await new Promise(resolveDelay => setTimeout(resolveDelay, intervalMs))
      }

      expect(tradesCount).toBeGreaterThan(0)
    } finally {
      // 恢复 Trades 配置原始状态，避免影响共享环境
      if (createdConfigId) {
        await tradesConfigService.delete(createdConfigId)
      }

      if (originalStates.length) {
        await Promise.all(
          originalStates.map(state =>
            tradesConfigService.update(state.id, {
              enabled: state.enabled,
              metadata: state.metadata ?? undefined,
            }),
          ),
        )
      }
    }
  })
})

