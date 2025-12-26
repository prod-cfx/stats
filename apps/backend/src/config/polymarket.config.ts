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
    reconnectDelayMs: number
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

export const polymarketConfig = registerAs('polymarket', (): PolymarketConfig => {
  const defaultCategory = env.str('POLYMARKET_CATEGORY', 'crypto')
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
      reconnectDelayMs: parsePositiveInt(env.str('POLYMARKET_CLOB_RECONNECT_DELAY_MS'), 5_000),
    },
    filters: {
      category: defaultCategory,
      tags: parseStringList(env.str('POLYMARKET_TAGS')),
    },
  }
})
