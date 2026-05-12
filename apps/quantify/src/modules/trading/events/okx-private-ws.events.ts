export const OKX_PRIVATE_ORDER_EVENT = 'trading.okx.private.order'
export const OKX_PRIVATE_POSITION_EVENT = 'trading.okx.private.position'

export interface OkxPrivateOrderEvent {
  exchangeId: 'okx'
  apiKey: string
  instId: string
  orderId: string
  clientOrderId?: string
  state: string
  side?: string
  orderType?: string
  avgPrice?: number
  fillPrice?: number
  filledSize?: number
  fee?: number
  feeCurrency?: string
  tradeId?: string
  updatedAt: Date
  raw: Record<string, unknown>
}

export interface OkxPrivatePositionEvent {
  exchangeId: 'okx'
  apiKey: string
  instId: string
  positionSide?: string
  quantity?: number
  avgPrice?: number
  updatedAt: Date
  raw: Record<string, unknown>
}
