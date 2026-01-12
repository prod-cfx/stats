import type { PrismaClient } from '@prisma/client'

/**
 * 数据拉取任务种子数据
 *
 * 这里会为已经在 DATA_PULL_JOB_REGISTRY 中注册的 Job 创建基础任务配置，
 * 避免每次在本地开发环境都要手动通过后台创建。
 */
export async function seedDataPullTasks(prisma: PrismaClient) {
  console.log('🌱 Seeding data-pull tasks...')

  const tasks = [
    {
      key: 'open-interest-sync',
      name: 'Coinglass 持仓量同步',
      source: 'coinglass',
      type: 'open-interest',
      // 每 5 分钟同步一次
      intervalSeconds: 300,
      enabled: false,
      cursor: JSON.stringify({
        symbol: 'BTC',
        exchange: 'All',
      } satisfies { symbol: string; exchange: string }),
    },
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
      enabled: false,
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
        url: 'https://bbx.com/zh-Hans/traditional-finance',
        waitTimeout: 10000,
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
          // 仅更新 meta 字段（如有），避免覆盖用户手动修改的其他配置
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

