/**
 * Trades WebSocket Adapter 接口定义
 * 用于订阅和处理各交易所的实时成交数据
 */

export type TradesAdapterKey =
  | 'okx-spot-trades'
  | 'okx-perp-trades'
  | 'okx-future-trades'
  | 'binance-spot-trades'
  | 'binance-perp-trades'
  | 'binance-future-trades'

export interface TradesConfig {
  exchange: string
  instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  symbol: string
  baseAsset: string
  quoteAsset: string
  enabled: boolean
  priority?: number
  metadata?: unknown
}

export interface TradesWsAdapter {
  readonly key: TradesAdapterKey

  /**
   * 确保 WebSocket 连接已建立
   */
  ensureConnected: () => Promise<void>

  /**
   * 同步目标配置，订阅新的交易对，取消已禁用的订阅
   */
  syncTargetConfigs: (configs: TradesConfig[]) => Promise<void>

  /**
   * 关闭所有连接和清理资源
   */
  shutdown: () => Promise<void>
}

