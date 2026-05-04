import type {
  CreateOrderInput,
  ExchangeId,
  MarketType,
  OrderSide,
  OrderType,
  TimeInForce,
  TradeMode,
  UnifiedInstrumentConstraints,
  UnifiedOrder,
} from '@/modules/trading/core/types'

export type OrderIntentSource = 'grid' | 'signal' | 'position_tool'
export type OrderIntentRole = 'spot_buy' | 'spot_sell' | 'open_long' | 'open_short' | 'close_long' | 'close_short'

export interface OrderIntent {
  source: OrderIntentSource
  sourceId: string
  userId: string
  exchangeAccountId?: string | null
  exchangeId: ExchangeId
  marketType: MarketType
  symbol: string
  side: OrderSide
  type: OrderType
  amount: number
  price?: number
  timeInForce?: TimeInForce
  role?: OrderIntentRole | null
  reduceOnly?: boolean
  tdMode?: TradeMode
  metadata?: Record<string, unknown>
}

export type TradingExecutionConstraints = UnifiedInstrumentConstraints

export interface NormalizedOrderIntent {
  request: CreateOrderInput
  normalizedPrice?: string
  normalizedAmount: string
  exchangeSize: string
  clientOrderId: string
  constraints: TradingExecutionConstraints
}

export type TradingExecutionResult =
  | { status: 'submitted'; intent: OrderIntent; normalized: NormalizedOrderIntent; order: UnifiedOrder }
  | { status: 'waiting_constraints'; intent: OrderIntent; reason: string; error?: unknown }
  | { status: 'waiting_position'; intent: OrderIntent; reason: string; error?: unknown }
  | { status: 'rejected'; intent: OrderIntent; reason: string; normalized?: NormalizedOrderIntent }
  | { status: 'submit_failed'; intent: OrderIntent; normalized: NormalizedOrderIntent; reason: string; error: unknown }
  | { status: 'reconcile_required'; intent: OrderIntent; reason: string; order?: UnifiedOrder; error?: unknown }
