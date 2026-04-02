import type { TickerData } from '@/lib/api'

/**
 * 从 ticker 数据计算涨跌幅
 */
export function calculateFromTicker(tickerData: TickerData, lastPrice: number) {
  const changePct = Number.parseFloat(tickerData.priceChangePercent24h || '0')
  return {
    changePct,
    changeAbs: lastPrice * (changePct / 100),
  }
}

/**
 * 计算价格涨跌幅和涨跌额
 * 优先级：实时 K线 + ticker 24h 前价格 > ticker 数据 > mock 数据
 */
export function calculatePriceChange(
  tickerData: TickerData | null,
  klineClosePrice: number | null,
  lastPrice: number,
  fallbackPct: number,
): { changePct: number; changeAbs: number } {
  // 优先：实时 K线 + ticker 24h 前价格
  if (tickerData?.priceChangePercent24h && klineClosePrice !== null) {
    const tickerChangePct = Number.parseFloat(tickerData.priceChangePercent24h)
    const currentPrice = Number.parseFloat(tickerData.currentPrice)

    // 数值校验
    if (!Number.isFinite(tickerChangePct) || !Number.isFinite(currentPrice)) {
      return calculateFromTicker(tickerData, lastPrice)
    }

    // 计算 24h 前价格
    const pctFactor = 1 + tickerChangePct / 100
    if (pctFactor === 0) {
      return calculateFromTicker(tickerData, lastPrice)
    }

    const price24hAgo = currentPrice / pctFactor
    if (!Number.isFinite(price24hAgo) || price24hAgo === 0) {
      return calculateFromTicker(tickerData, lastPrice)
    }

    // 基于实时价格重算涨跌幅
    const changeAbs = klineClosePrice - price24hAgo
    return {
      changePct: (changeAbs / price24hAgo) * 100,
      changeAbs,
    }
  }

  // 降级：仅使用 ticker 数据
  if (tickerData?.priceChangePercent24h) {
    return calculateFromTicker(tickerData, lastPrice)
  }

  // 最终降级：使用 mock 数据
  return {
    changePct: fallbackPct,
    changeAbs: lastPrice * (fallbackPct / 100),
  }
}

/**
 * TopBar 顶部展示口径：严格以 ticker last + 24h change% 为准。
 * - last: tickerData.currentPrice
 * - 24h change%: tickerData.priceChangePercent24h
 * ticker 缺失/不可解析时：沿用原有 mock 降级策略（Never break userspace）。
 */
export function calculateTopBarDisplayValues(options: {
  tickerData: TickerData | null
  isAggregated: boolean
  isBinance: boolean
  basePrice: number
  fallbackPct: number
}): { displayLastPrice: number; displayChangePct: number; displayChangeAbs: number } {
  const tickerLast = options.tickerData
    ? Number.parseFloat(options.tickerData.currentPrice)
    : Number.NaN
  const tickerChangePct = options.tickerData?.priceChangePercent24h
    ? Number.parseFloat(options.tickerData.priceChangePercent24h)
    : Number.NaN
  const tickerValid = Number.isFinite(tickerLast) && Number.isFinite(tickerChangePct)

  const displayLastPrice = tickerValid
    ? tickerLast
    : options.isAggregated
      ? options.basePrice
      : options.isBinance
        ? options.basePrice * 1.0001
        : options.basePrice * 0.9999

  const displayChangePct = tickerValid ? tickerChangePct : options.fallbackPct
  return {
    displayLastPrice,
    displayChangePct,
    displayChangeAbs: displayLastPrice * (displayChangePct / 100),
  }
}
