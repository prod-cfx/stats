import type {
  CreateOrderInput,
  OrderFillsQueryInput,
  OrderQueryInput,
  UnifiedBalance,
  UnifiedInstrumentConstraints,
  UnifiedOrder,
  UnifiedOrderFill,
  UnifiedPosition,
  UnifiedTicker,
} from './types'

export interface IExchangeClient {
  /**
   * 可选的初始化逻辑，例如加载交易所元数据、时间同步等。
   * 不要求幂等，但实现时建议可重复调用。
   */
  init: () => Promise<void>

  /**
   * 健康检查，用于探测交易所连通性。
   */
  ping: () => Promise<void>

  createOrder: (input: CreateOrderInput) => Promise<UnifiedOrder>

  cancelOrder: (id: string, symbol: string) => Promise<UnifiedOrder>

  fetchOrder: (id: string, symbol: string) => Promise<UnifiedOrder>

  fetchOrderByClientOrderId?: (query: OrderQueryInput & { clientOrderId: string; symbol: string }) => Promise<UnifiedOrder | null>

  fetchOpenOrders: (symbol?: string) => Promise<UnifiedOrder[]>

  fetchClosedOrders: (symbol?: string) => Promise<UnifiedOrder[]>

  fetchOrderFills?: (query: OrderFillsQueryInput) => Promise<UnifiedOrderFill[]>

  fetchPositions: () => Promise<UnifiedPosition[]>

  fetchBalance: () => Promise<UnifiedBalance[]>

  fetchTicker: (symbol: string) => Promise<UnifiedTicker>

  fetchInstrumentConstraints?: (symbol: string) => Promise<UnifiedInstrumentConstraints>
}
