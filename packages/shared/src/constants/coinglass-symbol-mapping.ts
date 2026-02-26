/**
 * Coinglass API Symbol 格式映射
 *
 * 不同交易所在 Coinglass API 中使用不同的 symbol 格式：
 * - Binance: BTCUSDT（无分隔符）
 * - OKX: BTC-USDT-SWAP（永续）/ BTC-USDT（现货）
 *
 * 本模块提供统一的 symbol 转换函数，将内部统一格式（如 BTCUSDT）
 * 转换为各交易所在 Coinglass API 中所需的格式。
 */

/**
 * 支持的交易所代码
 */
export type CoinglassExchangeCode = 'BINANCE' | 'OKX' | 'BYBIT' | 'BITGET' | 'HTX' | 'DERIBIT'

/**
 * 合约类型
 * - PERPETUAL: 永续合约
 * - SPOT: 现货
 * - null: 未指定（使用默认）
 */
export type CoinglassContractType = 'PERPETUAL' | 'SPOT' | null

/**
 * 内部统一 symbol 到 Coinglass API symbol 的映射配置
 *
 * 键为内部统一格式（如 BTCUSDT），值为各交易所的格式
 */
interface SymbolFormatConfig {
  /**
   * 将统一格式转换为交易所特定格式
   * @param baseSymbol 基础币种（如 BTC）
   * @param quoteSymbol 计价币种（如 USDT）
   * @param contractType 合约类型
   * @returns 交易所特定的 symbol 格式
   */
  format: (baseSymbol: string, quoteSymbol: string, contractType: CoinglassContractType) => string
}

/**
 * 各交易所的 symbol 格式化配置
 */
const EXCHANGE_SYMBOL_FORMATTERS: Record<CoinglassExchangeCode, SymbolFormatConfig> = {
  // Binance: BTCUSDT（无分隔符，永续和现货格式相同）
  BINANCE: {
    format: (base, quote, _contractType) => `${base}${quote}`,
  },

  // OKX: BTC-USDT-SWAP（永续）/ BTC-USDT（现货）
  OKX: {
    format: (base, quote, contractType) => {
      const baseFormat = `${base}-${quote}`
      if (contractType === 'PERPETUAL') {
        return `${baseFormat}-SWAP`
      }
      // 现货或未指定
      return baseFormat
    },
  },

  // Bybit: BTCUSDT（与 Binance 相同）
  BYBIT: {
    format: (base, quote, _contractType) => `${base}${quote}`,
  },

  // Bitget: BTCUSDT（与 Binance 相同）
  BITGET: {
    format: (base, quote, _contractType) => `${base}${quote}`,
  },

  // HTX (Huobi): BTC-USDT 格式
  HTX: {
    format: (base, quote, _contractType) => `${base}-${quote}`,
  },

  // Deribit: BTC-PERPETUAL 格式（特殊）
  DERIBIT: {
    format: (base, _quote, contractType) => {
      if (contractType === 'PERPETUAL') {
        return `${base}-PERPETUAL`
      }
      return base
    },
  },
}

/**
 * 从统一 symbol（如 BTCUSDT）解析出基础币种和计价币种
 *
 * 支持的格式：
 * - BTCUSDT -> { base: 'BTC', quote: 'USDT' }
 * - ETHUSDT -> { base: 'ETH', quote: 'USDT' }
 *
 * @param unifiedSymbol 统一格式的 symbol
 * @returns 解析结果，包含 base 和 quote
 */
export function parseUnifiedSymbol(unifiedSymbol: string): { base: string; quote: string } {
  // 常见的计价币种后缀（按长度降序排列，优先匹配更长的）
  const quoteSymbols = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH']

  const upperSymbol = unifiedSymbol.toUpperCase()

  for (const quote of quoteSymbols) {
    if (upperSymbol.endsWith(quote)) {
      const base = upperSymbol.slice(0, -quote.length)
      if (base.length > 0) {
        return { base, quote }
      }
    }
  }

  // 无法解析时，假设最后 4 个字符是计价币种（USDT）
  if (upperSymbol.length > 4) {
    return {
      base: upperSymbol.slice(0, -4),
      quote: upperSymbol.slice(-4),
    }
  }

  throw new Error(`Cannot parse unified symbol: ${unifiedSymbol}`)
}

/**
 * 将统一 symbol 转换为 Coinglass API 所需的交易所特定格式
 *
 * @param unifiedSymbol 统一格式的 symbol（如 BTCUSDT）
 * @param exchangeCode 交易所代码（如 BINANCE, OKX）
 * @param contractType 合约类型（PERPETUAL, SPOT, null）
 * @returns 交易所特定格式的 symbol
 *
 * @example
 * // Binance 永续
 * toCoinglassSymbol('BTCUSDT', 'BINANCE', 'PERPETUAL') // => 'BTCUSDT'
 *
 * // OKX 永续
 * toCoinglassSymbol('BTCUSDT', 'OKX', 'PERPETUAL') // => 'BTC-USDT-SWAP'
 *
 * // OKX 现货
 * toCoinglassSymbol('BTCUSDT', 'OKX', 'SPOT') // => 'BTC-USDT'
 */
export function toCoinglassSymbol(
  unifiedSymbol: string,
  exchangeCode: string,
  contractType: CoinglassContractType = null,
): string {
  const upperExchange = exchangeCode.toUpperCase() as CoinglassExchangeCode
  const formatter = EXCHANGE_SYMBOL_FORMATTERS[upperExchange]

  if (!formatter) {
    // 未知交易所，返回原始 symbol
    return unifiedSymbol
  }

  const { base, quote } = parseUnifiedSymbol(unifiedSymbol)
  return formatter.format(base, quote, contractType)
}

/**
 * 检查交易所是否支持 symbol 格式转换
 *
 * @param exchangeCode 交易所代码
 * @returns 是否支持
 */
export function isSupportedExchange(exchangeCode: string): exchangeCode is CoinglassExchangeCode {
  const upperExchange = exchangeCode.toUpperCase()
  return upperExchange in EXCHANGE_SYMBOL_FORMATTERS
}

/**
 * 获取所有支持的交易所代码列表
 */
export function getSupportedExchanges(): CoinglassExchangeCode[] {
  return Object.keys(EXCHANGE_SYMBOL_FORMATTERS) as CoinglassExchangeCode[]
}
