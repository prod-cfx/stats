import type { PrismaClient } from '@prisma/client'
import { OI_SYMBOLS } from '@ai/shared/constants/trading-symbols'

/**
 * 数据拉取任务种子数据
 *
 * 这里会为已经在 DATA_PULL_JOB_REGISTRY 中注册的 Job 创建基础任务配置，
 * 避免每次在本地开发环境都要手动通过后台创建。
 */
export async function seedDataPullTasks(prisma: PrismaClient) {
  console.log('🌱 Seeding data-pull tasks...')

  const tasks = [
    // Open Interest Sync - 各币种独立任务
    // 使用 @ai/shared 统一维护的币种列表，并错开执行时间避免 API 速率限制
    ...OI_SYMBOLS.map((symbol, index) => ({
      key: `open-interest-sync:${symbol}`,
      name: `Coinglass 持仓量同步 - ${symbol}`,
      source: 'coinglass',
      type: 'open-interest',
      // 基准 5 分钟 + 每个币种错开 10 秒，避免并发触发 API 速率限制
      intervalSeconds: 300 + index * 10,
      enabled: true,
      cursor: JSON.stringify({
        symbol,
        exchange: 'All',
      } satisfies { symbol: string; exchange: string }),
    })),
    {
      key: 'coinglass-hyperliquid-whale-alert',
      name: 'Hyperliquid 鲸鱼持仓预警',
      source: 'coinglass',
      type: 'whale-alert',
      // 每 5 分钟同步一次
      intervalSeconds: 300,
      enabled: false,
      cursor: null,
    },
    {
      key: 'coinglass-futures-price-history',
      name: 'Coinglass 合约价格 K 线历史',
      source: 'coinglass',
      type: 'futures-price-history',
      // 默认每 15 分钟同步一次，按需在后台调整
      intervalSeconds: 900,
      enabled: false,
      cursor: JSON.stringify({
        symbol: 'BTCUSDT',
        exchangeCode: 'BINANCE',
        contractType: 'PERPETUAL',
        interval: '4h',
      } satisfies {
        symbol: string
        exchangeCode: string
        contractType: string
        interval: string
      }),
    },
    {
      key: 'polymarket-markets-crypto',
      name: 'Polymarket 市场列表同步',
      source: 'polymarket',
      type: 'markets',
      // 每 10 分钟同步一次
      intervalSeconds: 600,
      enabled: true,
      cursor: null,
      meta: {
        category: '',
        onlyActive: true,
      },
    },
    {
      key: 'polymarket-orderbook-crypto',
      name: 'Polymarket Crypto 订单簿快照',
      source: 'polymarket',
      type: 'orderbook',
      // 每 5 分钟同步一次
      intervalSeconds: 300,
      enabled: false,
      cursor: null,
    },
    {
      key: 'bbx-crypto-stock-quotes',
      name: 'BBX 加密股票报价同步',
      source: 'bbx',
      type: 'crypto-stock-quotes',
      // 默认每 5 分钟同步一次，按需在后台调整
      intervalSeconds: 300,
      enabled: false,
      cursor: null,
      meta: {
        symbols: ['MSTR', 'COIN', 'MARA', 'RIOT', 'CLSK'],
      },
    },
    {
      key: 'bbx-crypto-stock-scraper',
      name: 'BBX 币股数据页面抓取',
      source: 'bbx',
      type: 'crypto-stock-scraper',
      // 页面抓取较慢，默认每 10 分钟同步一次
      intervalSeconds: 600,
      enabled: false,
      cursor: null,
      meta: {
        url: 'https://bbx.com/zh-Hans',
        waitTimeout: 10000,
      },
    },
    // Coinglass Pairs Markets - 各币种独立任务
    // 使用冒号前缀匹配，手动维护币种列表
    ...['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB'].map(symbol => ({
      key: `coinglass-pairs-markets:${symbol}`,
      name: `Coinglass Pairs Markets - ${symbol}`,
      source: 'COINGLASS',
      type: 'pairs-markets',
      intervalSeconds: 180, // 每3分钟
      enabled: true,
      cursor: JSON.stringify({ symbol }),
      meta: { symbol },
    })),
    // Coinglass Taker Buy/Sell Volume - 各币种主动买卖成交量
    // 一次 API 调用返回所有交易所的数据
    ...['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB'].map(symbol => ({
      key: `coinglass-taker-volume:${symbol}`,
      name: `Coinglass Taker Volume - ${symbol}`,
      source: 'COINGLASS',
      type: 'taker-volume',
      intervalSeconds: 300, // 每5分钟
      enabled: true,
      cursor: JSON.stringify({ symbol, range: '24h' }),
      meta: { symbol, range: '24h' },
    })),
    {
      key: 'hyperliquid-user-fills-sync',
      name: 'Hyperliquid 用户成交历史同步',
      source: 'hyperliquid',
      type: 'user-fills',
      // 每 10 分钟同步一次（Hyperliquid API 限制每次最多 2000 条）
      intervalSeconds: 600,
      enabled: false,
      cursor: JSON.stringify({
        userAddress: '',
        lastSyncTime: 0,
      } satisfies { userAddress: string; lastSyncTime: number }),
      meta: {
        description: '同步鲸鱼交易者的成交记录，用于历史 PnL 和交易行为分析',
        aggregateByTime: false,
      },
    },
    {
      key: 'hyperliquid-user-orders-sync',
      name: 'Hyperliquid 用户订单历史同步',
      source: 'hyperliquid',
      type: 'user-orders',
      // 每 10 分钟同步一次
      intervalSeconds: 600,
      enabled: false,
      cursor: JSON.stringify({
        userAddress: '',
        lastSyncTime: 0,
      } satisfies { userAddress: string; lastSyncTime: number }),
      meta: {
        description: '同步鲸鱼交易者的订单历史，包含已完成、已取消订单',
      },
    },
    {
      key: 'hyperliquid-user-funding-sync',
      name: 'Hyperliquid 用户资金费率同步',
      source: 'hyperliquid',
      type: 'user-funding',
      // 每 30 分钟同步一次（资金费率每 8 小时结算）
      intervalSeconds: 1800,
      enabled: false,
      cursor: JSON.stringify({
        userAddress: '',
        lastSyncTime: 0,
      } satisfies { userAddress: string; lastSyncTime: number }),
      meta: {
        description: '同步鲸鱼交易者的资金费率历史，用于计算持仓成本',
      },
    },
  ] as const

  let createdCount = 0
  let skippedCount = 0

  for (const task of tasks) {
    try {
      await prisma.dataPullTask.upsert({
        where: { key: task.key },
        update: {
          // 更新任务配置，保留 lastRunAt 让用户控制
          name: task.name,
          source: task.source,
          type: task.type,
          intervalSeconds: task.intervalSeconds,
          cursor: task.cursor,
          // 仅当 seed 中标记为 disabled 时强制禁用（系统级禁用，由 API 支持情况决定）
          // 这样可以确保新发现不支持的交易所会被自动禁用，同时不会重新启用用户手动禁用的任务
          ...(task.enabled === false ? { enabled: false } : {}),
          ...('meta' in task ? { meta: task.meta } : {}),
        },
        create: {
          key: task.key,
          name: task.name,
          source: task.source,
          type: task.type,
          intervalSeconds: task.intervalSeconds,
          enabled: task.enabled,
          cursor: task.cursor,
          meta: 'meta' in task ? task.meta : undefined,
        },
      })
      createdCount += 1
      console.log(`  ✓ ${task.key}`)
    } catch (error) {
      skippedCount += 1
      console.log(
        `  ⊘ ${task.key} (already exists or error: ${
          error instanceof Error ? error.message : String(error)
        })`,
      )
    }
  }

  console.log(
    `✅ Data-pull tasks seeded: ${createdCount} created, ${skippedCount} skipped`,
  )
}
