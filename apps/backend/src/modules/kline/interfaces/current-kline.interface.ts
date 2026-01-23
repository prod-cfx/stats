/**
 * 当前 K线状态接口
 * 用于在内存中维护正在聚合的 K线数据
 */
export interface CurrentKline {
  /**
   * 订阅键 (格式: exchange:instrumentType:symbol:interval)
   */
  subscriptionKey: string

  /**
   * 交易所代码
   */
  exchange: string

  /**
   * 合约类型
   */
  instrumentType: string

  /**
   * 交易对符号
   */
  symbol: string

  /**
   * 时间粒度 (1m, 5m, 15m, 1h, 4h, 1d)
   */
  interval: string

  /**
   * K线周期开始时间 (毫秒时间戳,已对齐到周期边界)
   */
  startTime: number

  /**
   * 开盘价
   */
  open: number

  /**
   * 最高价
   */
  high: number

  /**
   * 最低价
   */
  low: number

  /**
   * 收盘价 (当前最新价)
   */
  close: number

  /**
   * 成交量
   */
  volume: number

  /**
   * 成交笔数
   */
  tradeCount: number

  /**
   * 最后更新时间 (毫秒时间戳)
   */
  lastUpdateTime: number
}
