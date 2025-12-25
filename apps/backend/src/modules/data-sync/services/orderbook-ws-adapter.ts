import type { OrderbookPairConfig } from '@prisma/client'

export type OrderbookAdapterKey = `${string}.${'CEX' | 'DEX'}.${'SPOT' | 'PERPETUAL' | 'FUTURE'}`

/**
 * WS 订单薄同步适配器（交易所/venue 级别）。
 *
 * - 维护长连接（重连、心跳等）
 * - 动态订阅/退订（由配置 diff 驱动）
 * - 将更新写入 Redis（统一格式 VenueOrderBook）
 */
export interface OrderbookWsAdapter {
  /** 唯一 key，用于匹配分组后的配置，例如 "BINANCE.CEX.SPOT" */
  readonly key: OrderbookAdapterKey

  /** 确保连接就绪（内部实现可做懒连接/重连） */
  ensureConnected: () => Promise<void>

  /**
   * 将 adapter 的订阅状态同步到目标配置集合：
   * - 新增配置 → SUBSCRIBE + snapshot 初始化
   * - 移除配置 → UNSUBSCRIBE + 清理本地状态
   * - 配置变更（例如 depthLevels）→ 更新本地策略
   */
  syncTargetConfigs: (configs: OrderbookPairConfig[]) => Promise<void>

  /** 关闭资源（应用退出时调用） */
  shutdown: () => Promise<void>
}

export function toAdapterKey(config: Pick<OrderbookPairConfig, 'venue' | 'venueType' | 'instrumentType'>): OrderbookAdapterKey {
  return `${String(config.venue).toUpperCase()}.${String(config.venueType)}.${String(config.instrumentType)}` as OrderbookAdapterKey
}

