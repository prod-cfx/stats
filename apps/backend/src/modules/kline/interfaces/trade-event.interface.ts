/**
 * 交易事件接口
 * 用于 EventEmitter 在 Trades 适配器和 K线聚合器之间传递交易数据
 */
export interface TradeEvent {
  /**
   * 交易所代码 (如 BINANCE, OKX)
   */
  exchange: string

  /**
   * 合约类型 (如 PERPETUAL, SPOT)
   */
  instrumentType: string

  /**
   * 交易对符号 (如 BTCUSDT)
   */
  symbol: string

  /**
   * 成交价格
   */
  price: number

  /**
   * 成交数量
   */
  size: number

  /**
   * 成交方向
   */
  side: 'buy' | 'sell'

  /**
   * 成交时间戳 (毫秒)
   */
  timestamp: number
}

/**
 * 交易接收事件名称
 * 用于 EventEmitter2 事件订阅
 */
export const TRADE_RECEIVED_EVENT = 'trade.received'
