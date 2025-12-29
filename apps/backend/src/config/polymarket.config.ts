import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor, parsePositiveInt } from '../common/env/env.accessor'

const env = defaultEnvAccessor

export interface PolymarketConfig {
  gamma: {
    apiKey?: string
    baseUrl: string
    timeoutMs: number
    maxLimit: number
  }
  clob: {
    apiKey?: string
    restBaseUrl: string
    wsUrl: string
    timeoutMs: number
  }
  filters: {
    category?: string
    tags: string[]
  }
}

const parseStringList = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : []

// 注意：与 Polymarket 相关的分类与标签（category/tags）
// 现在通过 env 提供全局默认值，再由具体 Job 的任务 meta 进行覆盖；
// timeout/maxLimit 也保留 env 覆盖能力（不同环境可通过 .env.* 调优），默认值仍为 10s / 200。
export const polymarketConfig = registerAs('polymarket', (): PolymarketConfig => {
  // 标准化 category：统一转小写并去空格，确保与数据库存储格式一致
  const rawCategory = env.str('POLYMARKET_CATEGORY', 'crypto')
  const normalizedCategory = rawCategory ? rawCategory.trim().toLowerCase() : 'crypto'
  
  return {
    gamma: {
      apiKey: env.str('POLYMARKET_GAMMA_API_KEY'),
      baseUrl: env.str('POLYMARKET_GAMMA_BASE_URL', 'https://gamma-api.polymarket.com'),
      timeoutMs: parsePositiveInt(env.str('POLYMARKET_GAMMA_TIMEOUT_MS'), 10_000),
      maxLimit: parsePositiveInt(env.str('POLYMARKET_GAMMA_LIMIT'), 200),
    },
    clob: {
      apiKey: env.str('POLYMARKET_CLOB_API_KEY'),
      restBaseUrl: env.str('POLYMARKET_CLOB_BASE_URL', 'https://clob.polymarket.com'),
      wsUrl: env.str('POLYMARKET_CLOB_WS_URL', 'wss://ws-subscriptions.polymarket.com'),
      timeoutMs: parsePositiveInt(env.str('POLYMARKET_CLOB_TIMEOUT_MS'), 10_000),
    },
    filters: {
      category: normalizedCategory,
      tags: parseStringList(env.str('POLYMARKET_TAGS')),
    },
  }
})
