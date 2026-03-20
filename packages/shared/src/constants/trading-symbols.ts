/**
 * 交易符号常量
 *
 * 集中管理所有支持的交易对符号，避免在多处硬编码
 */

/**
 * Open Interest (OI) 持仓量同步支持的币种列表
 *
 * 用于：
 * - 后端数据拉取任务种子数据 (apps/backend/prisma/seeds/data-pull-tasks.seed.ts)
 * - 前端 aggregated-orderbook 的 OI Tab (apps/front/src/components/aggregated-orderbook/AggregatedOI.tsx)
 */
export const OI_SYMBOLS = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'DOGE',
  'HYPE',
  'BNB',
  'ZEC',
  'BCH',
  'SUI',
  'ADA',
  'LINK',
  'AVAX',
] as const

/**
 * OI_SYMBOLS 的 TypeScript 类型
 */
export type OISymbol = typeof OI_SYMBOLS[number]
