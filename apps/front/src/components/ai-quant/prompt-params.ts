import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'

const EXCHANGE_MAP: Array<{ pattern: RegExp, exchange: QuantParams['exchange'] }> = [
  { pattern: /\bOKX\b/i, exchange: 'okx' },
  { pattern: /\bBINANCE\b/i, exchange: 'binance' },
  { pattern: /\bHYPERLIQUID\b/i, exchange: 'hyperliquid' },
]

export function deriveQuantParamsFromPrompt(input: string, current: QuantParams): QuantParams {
  const text = input.trim()
  if (!text) return current

  const next: QuantParams = { ...current }
  const upper = text.toUpperCase()

  const slashSymbolMatch = upper.match(/\b([A-Z]{2,12})\s*\/\s*(USDT|USDC|USD)\b/)
  const compactSymbolMatch = upper.match(/\b([A-Z]{2,12}(?:USDT|USDC|USD))\b/)
  const symbol = slashSymbolMatch
    ? `${slashSymbolMatch[1]}${slashSymbolMatch[2]}`
    : compactSymbolMatch?.[1]
  if (symbol) {
    next.symbol = symbol
  }

  for (const candidate of EXCHANGE_MAP) {
    if (candidate.pattern.test(text)) {
      next.exchange = candidate.exchange
      break
    }
  }

  const timeframeMatch = text.match(/交易周期[：: ]*(?:[\x09-\x0D\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]\s*)?(\d{1,4})\s*(分钟|min|m|小时|h)/i)
  if (timeframeMatch?.[1] && timeframeMatch[2]) {
    const rawValue = Number(timeframeMatch[1])
    if (Number.isFinite(rawValue) && rawValue > 0) {
      const normalized = /小时|h/i.test(timeframeMatch[2]) ? rawValue * 60 : rawValue
      next.buyWindowMin = normalized
      next.sellWindowMin = normalized
    }
  }

  const takeProfitMatch = text.match(/止盈[^%\n]*?(\d+(?:\.\d+)?)\s*%/)
  if (takeProfitMatch?.[1]) {
    const takeProfitPct = Number(takeProfitMatch[1])
    if (Number.isFinite(takeProfitPct) && takeProfitPct > 0) {
      next.sellRisePct = takeProfitPct
    }
  }

  const stopLossMatch = text.match(/止损[^%\n]*?(\d+(?:\.\d+)?)\s*%/)
  if (stopLossMatch?.[1]) {
    const stopLossPct = Number(stopLossMatch[1])
    if (Number.isFinite(stopLossPct) && stopLossPct > 0) {
      next.buyDropPct = stopLossPct
    }
  }

  const balanceMatch = text.match(/账户余额[：: ]*(?:[\x09-\x0D\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]\s*)?(\d+(?:\.\d+)?)\s*USDT/i)
  const buyAmountMatch = text.match(/(?:开仓|买入)[^。\n]*?(\d+(?:\.\d+)?)\s*USDT/i)
  if (balanceMatch?.[1] && buyAmountMatch?.[1]) {
    const balance = Number(balanceMatch[1])
    const buyAmount = Number(buyAmountMatch[1])
    if (Number.isFinite(balance) && balance > 0 && Number.isFinite(buyAmount) && buyAmount > 0) {
      next.positionPct = Number(Math.min(100, Math.max(1, (buyAmount / balance) * 100)).toFixed(2))
    }
  }

  return next
}
