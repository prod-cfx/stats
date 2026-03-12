import type { ExchangeId } from '../core/types'

export interface BinanceConfig {
  apiKey: string
  secret: string
  recvWindow?: number
  spotEnabled?: boolean
  futuresEnabled?: boolean
  /**
   * 鏄惁浣跨敤娴嬭瘯缃?妯℃嫙鐩樸€?
   * - Binance: 鍒囨崲鍒板畼鏂?testnet 鍩熷悕
   */
  isTestnet?: boolean
}

export interface OkxConfig {
  apiKey: string
  secret: string
  passphrase: string
  useUnifiedAccount?: boolean
  /**
   * 鏄惁鍚敤 OKX 妯℃嫙鐩?(x-simulated-trading = 1)
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
   * 鎸夎处鎴?ID 绮剧‘鑾峰彇閰嶇疆锛堢敤浜?LLM 璁㈤槄绛夐渶瑕佹寚瀹氬叿浣撹处鎴风殑鍦烘櫙锛?
   * @param accountId 璐︽埛 ID
   * @param userId 鐢ㄦ埛 ID锛堝繀椤伙紝鐢ㄤ簬闃叉瓒婃潈璁块棶锛?
   */
  getAccountConfigById: (accountId: string, userId: string) => Promise<ExchangeAccountConfig | null>
}
