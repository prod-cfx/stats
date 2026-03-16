import type { ExchangeId } from '../core/types'

export interface BinanceConfig {
  apiKey: string
  secret: string
  recvWindow?: number
  spotEnabled?: boolean
  futuresEnabled?: boolean
  /**
   * 是否使用测试网/模拟盘？
   * - Binance: 切换到官方 testnet 域名
   */
  isTestnet?: boolean
}

export interface OkxConfig {
  apiKey: string
  secret: string
  passphrase: string
  useUnifiedAccount?: boolean
  /**
   * 是否启用 OKX 模拟盘（x-simulated-trading = 1）
   */
  isTestnet?: boolean
}

export interface HyperliquidConfig {
  mainWalletAddress: string
  agentPrivateKey: string
  isTestnet?: boolean
}

export type ExchangeAccountConfig =
  | { exchangeId: 'binance'; config: BinanceConfig }
  | { exchangeId: 'okx'; config: OkxConfig }
  | { exchangeId: 'hyperliquid'; config: HyperliquidConfig }

export interface ExchangeAccountStore {
  getAccountConfig: (userId: string, exchangeId: ExchangeId) => Promise<ExchangeAccountConfig | null>
  /**
   * 按账户 ID 精确获取配置（用于 LLM 订阅等需要指定具体账户的场景）。
   * @param accountId 账户 ID
   * @param userId 用户 ID（必须，用于防止越权访问）
   */
  getAccountConfigById: (accountId: string, userId: string) => Promise<ExchangeAccountConfig | null>
}
