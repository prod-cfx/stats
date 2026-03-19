/**
 * 应用常量配置
 */

/**
 * 交易对图标映射
 */
export const SYMBOL_ICONS: Record<string, string> = {
  BTC: '/images/icon-btc.svg',
  ETH: '/images/icon-eth.svg',
  SOL: '/images/icon-sol.svg',
  DOGE: '/images/icon-doge.svg',
  BNB: '/images/icon-bnb.svg',
}

/**
 * 默认图标路径
 */
export const DEFAULT_SYMBOL_ICON = '/images/icon-default.svg'

/**
 * 获取交易对图标
 */
export function getSymbolIcon(symbol: string): string {
  const baseSymbol = symbol.replace(/USDT$|USD$|PERP$/i, '').toUpperCase()
  return SYMBOL_ICONS[baseSymbol] || DEFAULT_SYMBOL_ICON
}

/**
 * API 分页默认限制
 */
export const API_PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const
