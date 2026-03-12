import type {
  CreateOrderInput,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from './types'

export interface IExchangeClient {
  /**
   * 鍙€夌殑鍒濆鍖栭€昏緫锛屼緥濡傚姞杞戒氦鏄撴墍鍏冩暟鎹€佹椂闂村悓姝ョ瓑銆?
   * 涓嶈姹傚箓绛夛紝浣嗗疄鐜版椂寤鸿鍙噸澶嶈皟鐢ㄣ€?
   */
  init: () => Promise<void>

  /**
   * 鍋ュ悍妫€鏌ワ紝鐢ㄤ簬鎺㈡祴浜ゆ槗鎵€杩為€氭€с€?
   */
  ping: () => Promise<void>

  createOrder: (input: CreateOrderInput) => Promise<UnifiedOrder>

  cancelOrder: (id: string, symbol: string) => Promise<UnifiedOrder>

  fetchOrder: (id: string, symbol: string) => Promise<UnifiedOrder>

  fetchOpenOrders: (symbol?: string) => Promise<UnifiedOrder[]>

  fetchClosedOrders: (symbol?: string) => Promise<UnifiedOrder[]>

  fetchPositions: () => Promise<UnifiedPosition[]>

  fetchBalance: () => Promise<UnifiedBalance[]>

  fetchTicker: (symbol: string) => Promise<UnifiedTicker>
}
