import { OI_SYMBOLS } from '@ai/shared'
import type { PrismaClient } from '../../generated/prisma'
import { isPublicDataTaskKey, shouldEnablePublicDataTaskByDefault } from './data-pull-task-policy'

const COINGLASS_TAKER_VOLUME_RANGES = ['5m', '15m', '30m', '1h', '4h', '12h', '24h'] as const

/**
 * 数据拉取任务种子数据
 *
 * 这里会为已经在 DATA_PULL_JOB_REGISTRY 中注册的 Job 创建基础任务配置，
 * 避免每次在本地开发环境都要手动通过后台创建。
 */
export async function seedDataPullTasks(prisma: PrismaClient) {
  console.log('🌱 Seeding data-pull tasks...')
  const appEnv = process.env.APP_ENV

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
      enabled: shouldEnablePublicDataTaskByDefault(appEnv, 'coinglass-hyperliquid-whale-alert'),
      cursor: null,
    },
    {
      key: 'coinglass-hyperliquid-whale-position',
      name: 'Hyperliquid 鲸鱼持仓快照',
      source: 'coinglass',
      type: 'whale-position',
      // 每 5 分钟同步一次
      intervalSeconds: 300,
      enabled: shouldEnablePublicDataTaskByDefault(appEnv, 'coinglass-hyperliquid-whale-position'),
      cursor: null,
    },
    // Coinglass Futures Price History - 主流币种多时间粒度 K线同步
    // 为每个币种和时间粒度创建独立任务，避免单个任务过载
    ...(() => {
      // Binance 合约交易对格式：BTCUSDT, ETHUSDT 等
      const symbols = [
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'XRPUSDT',
        'DOGEUSDT',
        'BNBUSDT',
        'HYPEUSDT',
      ] as const
      const intervals = [
        { interval: '1m' as const, syncSeconds: 120, priority: 3 }, // 1分钟粒度，每2分钟同步（低优先级）
        { interval: '5m' as const, syncSeconds: 300, priority: 1 }, // 5分钟粒度，每5分钟同步（高优先级）✅
        { interval: '15m' as const, syncSeconds: 600, priority: 1 }, // 15分钟粒度，每10分钟同步（高优先级）
        { interval: '30m' as const, syncSeconds: 900, priority: 2 }, // 30分钟粒度，每15分钟同步（中优先级）
        { interval: '1h' as const, syncSeconds: 1800, priority: 1 }, // 1小时粒度，每30分钟同步（高优先级）
        { interval: '4h' as const, syncSeconds: 3600, priority: 1 }, // 4小时粒度，每1小时同步（高优先级）
        { interval: '1d' as const, syncSeconds: 7200, priority: 1 }, // 1天粒度，每2小时同步（高优先级）
      ] as const

      const contractTypes = [
        { type: 'PERPETUAL', label: '永续', priority: 1 }, // 高优先级
        { type: null, label: '现货', priority: 2 }, // 低优先级（可选）
      ] as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string
      }> = []

      let delayOffset = 0
      for (const symbol of symbols) {
        for (const { type: contractType, label, priority: typePriority } of contractTypes) {
          for (const { interval, syncSeconds, priority: intervalPriority } of intervals) {
            // 每个任务错开 10 秒执行，避免并发触发 API 速率限制
            const keyType = contractType ?? 'SPOT'
            // 只启用高优先级任务（永续合约 + 15m/1h/4h/1d）
            const isHighFrequency = interval === '1m' || interval === '3m' || interval === '5m'
            const enabled = intervalPriority === 1 && typePriority === 1 && !isHighFrequency
            tasks.push({
              key: `coinglass-futures-price-history:${symbol}:${keyType}:${interval}`,
              name: `Coinglass K线 - ${symbol} ${label} ${interval}`,
              source: 'coinglass',
              type: 'futures-price-history',
              intervalSeconds: syncSeconds + delayOffset,
              enabled,
              cursor: JSON.stringify({
                symbol,
                exchangeCode: 'BINANCE',
                contractType,
                interval,
              }),
            })
            delayOffset = (delayOffset + 10) % 120 // 错开 10 秒，120 秒循环
          }
        }
      }

      return tasks
    })(),
    // Coinglass Futures Price History - OKX 交易所主流币种多时间粒度 K线同步
    // 与 Binance 配置保持一致的结构，使用 OKX 交易所代码
    ...(() => {
      // OKX 使用统一格式存储（BTCUSDT）；API 请求时自动转换为 OKX 格式（如 BTC-USDT-SWAP）
      const symbols = [
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'XRPUSDT',
        'DOGEUSDT',
        'BNBUSDT',
        'HYPEUSDT',
      ] as const
      const intervals = [
        { interval: '1m' as const, syncSeconds: 120, priority: 3 }, // 1分钟粒度，每2分钟同步（低优先级）
        { interval: '5m' as const, syncSeconds: 300, priority: 1 }, // 5分钟粒度，每5分钟同步（高优先级）✅
        { interval: '15m' as const, syncSeconds: 600, priority: 1 }, // 15分钟粒度，每10分钟同步（高优先级）
        { interval: '30m' as const, syncSeconds: 900, priority: 2 }, // 30分钟粒度，每15分钟同步（中优先级）
        { interval: '1h' as const, syncSeconds: 1800, priority: 1 }, // 1小时粒度，每30分钟同步（高优先级）
        { interval: '4h' as const, syncSeconds: 3600, priority: 1 }, // 4小时粒度，每1小时同步（高优先级）
        { interval: '1d' as const, syncSeconds: 7200, priority: 1 }, // 1天粒度，每2小时同步（高优先级）
      ] as const

      const contractTypes = [
        { type: 'PERPETUAL', label: '永续', priority: 1 }, // 高优先级
        { type: null, label: '现货', priority: 2 }, // 低优先级（可选）
      ] as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string
      }> = []

      let delayOffset = 0
      for (const symbol of symbols) {
        for (const { type: contractType, label, priority: typePriority } of contractTypes) {
          for (const { interval, syncSeconds, priority: intervalPriority } of intervals) {
            // 每个任务错开 10 秒执行，避免并发触发 API 速率限制
            const keyType = contractType ?? 'SPOT'
            // 只启用高优先级任务（永续合约 + 15m/1h/4h/1d）
            const isHighFrequency = interval === '1m' || interval === '3m' || interval === '5m'
            const enabled = intervalPriority === 1 && typePriority === 1 && !isHighFrequency
            tasks.push({
              key: `coinglass-futures-price-history:${symbol}:OKX:${keyType}:${interval}`,
              name: `Coinglass K线 (OKX) - ${symbol} ${label} ${interval}`,
              source: 'coinglass',
              type: 'futures-price-history',
              intervalSeconds: syncSeconds + delayOffset,
              enabled,
              cursor: JSON.stringify({
                symbol,
                exchangeCode: 'OKX',
                contractType,
                interval,
              }),
            })
            delayOffset = (delayOffset + 10) % 120 // 错开 10 秒，120 秒循环
          }
        }
      }

      return tasks
    })(),
    // Coinglass Long/Short Ratio - 多空比历史数据（聚合多空比指标）
    // 为主流交易对 + 时间粒度创建独立任务，支持 TradingView 指标展示
    ...(() => {
      const pairs = [
        { tradingPairId: 'BTCUSDT.BINANCE.PERP', symbol: 'BTCUSDT' },
        { tradingPairId: 'ETHUSDT.BINANCE.PERP', symbol: 'ETHUSDT' },
        { tradingPairId: 'SOLUSDT.BINANCE.PERP', symbol: 'SOLUSDT' },
      ] as const
      const intervals = [
        { interval: '1m' as const, syncSeconds: 300 },
        { interval: '3m' as const, syncSeconds: 450 },
        { interval: '5m' as const, syncSeconds: 600 },
        { interval: '15m' as const, syncSeconds: 900 },
        { interval: '30m' as const, syncSeconds: 1200 },
        { interval: '1h' as const, syncSeconds: 1800 },
        { interval: '4h' as const, syncSeconds: 3600 },
        { interval: '6h' as const, syncSeconds: 5400 },
        { interval: '8h' as const, syncSeconds: 7200 },
        { interval: '12h' as const, syncSeconds: 10800 },
        { interval: '1d' as const, syncSeconds: 7200 },
        { interval: '1w' as const, syncSeconds: 21600 },
      ] as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string
      }> = []

      let delayOffset = 0
      for (const pair of pairs) {
        for (const { interval, syncSeconds } of intervals) {
          const isHighFrequency = interval === '1m' || interval === '3m' || interval === '5m'
          tasks.push({
            key: `coinglass-long-short-ratio:${pair.tradingPairId}:${interval}`,
            name: `Coinglass 多空比 - ${pair.symbol} ${interval}`,
            source: 'coinglass',
            type: 'long-short-ratio',
            intervalSeconds: syncSeconds + delayOffset,
            enabled: !isHighFrequency,
            cursor: JSON.stringify({
              tradingPairId: pair.tradingPairId,
              symbol: pair.symbol,
              interval,
              exchange: 'Binance',
            }),
          })
          delayOffset = (delayOffset + 10) % 120 // 错开 10 秒，120 秒循环
        }
      }

      return tasks
    })(),
    // Binance Kline History - 主流币种多时间粒度 K线同步（免费 API，无需 API Key）
    // 为每个币种和时间粒度创建独立任务，避免单个任务过载
    ...(() => {
      // Binance 交易对格式：BTCUSDT, ETHUSDT 等
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'BNBUSDT'] as const
      const intervals = [
        { interval: '1m' as const, syncSeconds: 120, priority: 3 }, // 1分钟粒度，每2分钟同步（低优先级）
        { interval: '5m' as const, syncSeconds: 300, priority: 1 }, // 5分钟粒度，每5分钟同步（高优先级）✅
        { interval: '15m' as const, syncSeconds: 600, priority: 1 }, // 15分钟粒度，每10分钟同步（高优先级）
        { interval: '30m' as const, syncSeconds: 900, priority: 2 }, // 30分钟粒度，每15分钟同步（中优先级）
        { interval: '1h' as const, syncSeconds: 1800, priority: 1 }, // 1小时粒度，每30分钟同步（高优先级）
        { interval: '4h' as const, syncSeconds: 3600, priority: 1 }, // 4小时粒度，每1小时同步（高优先级）
        { interval: '1d' as const, syncSeconds: 7200, priority: 1 }, // 1天粒度，每2小时同步（高优先级）
      ] as const

      const marketTypes = [
        { type: 'PERPETUAL' as const, label: '永续', priority: 1 }, // 高优先级
        { type: 'SPOT' as const, label: '现货', priority: 2 }, // 低优先级
      ] as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string
      }> = []

      let delayOffset = 0
      for (const symbol of symbols) {
        for (const { type: marketType, label, priority: typePriority } of marketTypes) {
          for (const { interval, syncSeconds, priority: intervalPriority } of intervals) {
            // 只启用高优先级任务（永续合约 + 5m/15m/1h/4h/1d）
            const enabled = intervalPriority === 1 && typePriority === 1
            tasks.push({
              key: `binance-kline-history:${symbol}:${marketType}:${interval}`,
              name: `Binance K线 - ${symbol} ${label} ${interval}`,
              source: 'binance',
              type: 'kline-history',
              // 使用标准同步间隔，任务错开由调度器的 jitter 机制处理
              intervalSeconds: syncSeconds,
              enabled,
              cursor: JSON.stringify({
                symbol,
                marketType,
                interval,
              }),
            })
            delayOffset = (delayOffset + 10) % 120 // 保留变量以维持循环结构
          }
        }
      }

      return tasks
    })(),
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
      enabled: shouldEnablePublicDataTaskByDefault(appEnv, 'bbx-crypto-stock-quotes'),
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
      enabled: shouldEnablePublicDataTaskByDefault(appEnv, 'bbx-crypto-stock-scraper'),
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
    // Coinglass Taker Buy/Sell Volume - 各币种各时间范围主动买卖成交量
    // 为每个 symbol + range 组合创建独立任务
    ...(() => {
      const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB'] as const
      const ranges = COINGLASS_TAKER_VOLUME_RANGES
      const rangeIntervals = {
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '4h': 7200,
        '12h': 21600,
        '24h': 43200,
      } as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string | null
        meta: { symbol: string; range: string }
      }> = []

      let delayOffset = 0
      for (const symbol of symbols) {
        for (const range of ranges) {
          const baseIntervalSeconds = rangeIntervals[range]
          tasks.push({
            key: `coinglass-taker-volume:${symbol}:${range}`,
            name: `Coinglass Taker Volume - ${symbol} ${range}`,
            source: 'COINGLASS',
            type: 'taker-volume',
            intervalSeconds: baseIntervalSeconds + delayOffset,
            enabled: true,
            cursor: null,
            meta: { symbol, range },
          })
          delayOffset = (delayOffset + 10) % 120
        }
      }

      return tasks
    })(),
    // Coinglass OI OHLC Aggregated History - 聚合持仓量 K 线数据
    // 为每个币种和时间粒度创建独立任务
    ...(() => {
      const symbols = [
        'BTC',
        'ETH',
        'SOL',
        'XRP',
        'DOGE',
        'ADA',
        'AVAX',
        'LINK',
        'DOT',
        'MATIC',
      ] as const
      const intervals = [
        { interval: '1h' as const, syncSeconds: 900, priority: 1 }, // 1小时粒度，每15分钟同步（高优先级）
        { interval: '4h' as const, syncSeconds: 900, priority: 1 }, // 4小时粒度，每15分钟同步（高优先级）
      ] as const

      const tasks: Array<{
        key: string
        name: string
        source: string
        type: string
        intervalSeconds: number
        enabled: boolean
        cursor: string | null
        meta: { symbol: string; interval: string }
      }> = []

      let delayOffset = 0
      for (const symbol of symbols) {
        for (const { interval, syncSeconds } of intervals) {
          // 每个任务错开 10 秒执行，避免并发触发 API 速率限制
          tasks.push({
            key: `coinglass-oi-ohlc-aggregated:${symbol}-${interval}`,
            name: `Coinglass OI OHLC - ${symbol} ${interval}`,
            source: 'coinglass',
            type: 'oi-ohlc-aggregated',
            intervalSeconds: syncSeconds + delayOffset,
            enabled: true,
            cursor: null, // 首次运行时会自动回溯 30 天
            meta: {
              symbol,
              interval,
            },
          })
          delayOffset = (delayOffset + 10) % 120 // 错开 10 秒，120 秒循环
        }
      }

      return tasks
    })(),
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

  for (const task of tasks) {
    if (task.type !== 'taker-volume') {
      continue
    }

    const meta = 'meta' in task ? task.meta : null
    if (!meta || !meta.symbol || !meta.range) {
      throw new Error(`Invalid taker-volume task meta for key=${task.key}`)
    }

    if (
      !COINGLASS_TAKER_VOLUME_RANGES.includes(
        meta.range as (typeof COINGLASS_TAKER_VOLUME_RANGES)[number],
      )
    ) {
      throw new Error(`Invalid taker-volume range for key=${task.key}: ${meta.range}`)
    }
  }

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
          // staging / production 的公共看板依赖这些任务，seed 需要把它们恢复到系统默认启用状态。
          ...(isPublicDataTaskKey(task.key) && task.enabled ? { enabled: true } : {}),
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

  console.log(`✅ Data-pull tasks seeded: ${createdCount} created, ${skippedCount} skipped`)
}
