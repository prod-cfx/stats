import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor } from '../common/env/env.accessor'

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
}

// 注意：与 Polymarket 相关的分类与标签（category/tags）
// 现在只在具体 Job 的任务 meta 中配置，避免通过全局 env 控制。
// 这里仅保留访问 Gamma/CLOB API 所需的基础配置与固定默认值（timeout/maxLimit 如需调整，请直接修改本配置）。
export const polymarketConfig = registerAs('polymarket', (): PolymarketConfig => {
  return {
    gamma: {
      apiKey: env.str('POLYMARKET_GAMMA_API_KEY'),
      baseUrl: env.str('POLYMARKET_GAMMA_BASE_URL', 'https://gamma-api.polymarket.com'),
      timeoutMs: 10_000,
      maxLimit: 200,
    },
    clob: {
      apiKey: env.str('POLYMARKET_CLOB_API_KEY'),
      restBaseUrl: env.str('POLYMARKET_CLOB_BASE_URL', 'https://clob.polymarket.com'),
      wsUrl: env.str('POLYMARKET_CLOB_WS_URL', 'wss://ws-subscriptions.polymarket.com'),
      timeoutMs: 10_000,
    },
  }
})
