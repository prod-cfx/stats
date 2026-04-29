import type { Prisma } from '@/prisma/prisma.types'

export type GridRuntimeMode = 'spot' | 'perp_long' | 'perp_short' | 'perp_neutral'

export type GridOrderSide = 'buy' | 'sell'

export type GridOrderRole = 'spot_buy' | 'spot_sell' | 'open_long' | 'close_long' | 'open_short' | 'close_short'

export interface GridRuntimeConfigSnapshot {
  mode: GridRuntimeMode
  lowerPrice: string
  upperPrice: string
  gridCount: number
  perOrderQuote: string
  quoteAsset: string
  baseAsset: string
  orderType: 'limit'
  timeInForce: 'gtc'
}

export interface GridLevelPlan {
  levelIndex: number
  price: string
  side: GridOrderSide | 'neutral'
  role: string | null
  baseQuantity: string | null
  quoteBudget: string | null
  status: string
}

export interface GridPlannedOrder {
  levelIndex: number
  side: GridOrderSide
  role: GridOrderRole
  orderType: 'limit'
  timeInForce: 'gtc'
  price: string
  quantity: string
  quoteBudget: string
  baseAsset: string
  quoteAsset: string
}

export interface GridOrderPlan {
  config: GridRuntimeConfigSnapshot
  levels: GridLevelPlan[]
  orders: GridPlannedOrder[]
}

export interface PlanGridOrdersInput {
  config: GridRuntimeConfigSnapshot
  currentPrice: string
}

export type GridRuntimeJsonValue = Prisma.JsonValue
