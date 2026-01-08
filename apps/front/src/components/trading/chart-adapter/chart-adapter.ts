export type Unsubscribe = () => void

/**
 * 图表适配器：把「清算地图 overlay」对具体图表库的依赖集中到这里。
 *
 * 目标：未来切换 TradingView 等实现时，只替换适配器实现，不改清算地图主体。
 */
export interface ChartAdapter {
  /** price -> y(px)，用于 overlay 严格对齐价格 */
  getPriceToY: (price: number) => number | null

  /** y(px) -> price，用于 hover/click 反查价格 */
  getYToPrice: (y: number) => number | null

  /**
   * 订阅图表视窗变更（拖拽/缩放等），用于触发 overlay refresh。
   * 返回取消订阅函数。
   */
  subscribeChartChange: (cb: () => void) => Unsubscribe

  /** 订阅十字线移动（用于 overlay tooltip），返回取消订阅函数 */
  subscribeCrosshairMove: (cb: (param: unknown) => void) => Unsubscribe

  /** 订阅点击（用于 overlay tooltip lock），返回取消订阅函数 */
  subscribeClick: (cb: (param: unknown) => void) => Unsubscribe

  /** 获取当前价格（与顶部显示同源），用于 overlay 当前价线/tooltip 分界 */
  getCurrentPrice: () => number
}


