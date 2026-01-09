export type UnitSize = 'S' | 'M' | 'L' | 'XL'

export const UNIT_SIZE_PRESETS: Record<UnitSize, { w: number; h: number; label: string }> = {
  S: { w: 6, h: 3, label: 'S' }, // Default small tile
  M: { w: 6, h: 6, label: 'M' }, // Double height
  L: { w: 12, h: 6, label: 'L' }, // Full width
  XL: { w: 12, h: 9, label: 'XL' }, // Full width + taller
}

// K线（market.kline）专用尺寸：S 更矮(h=3)且更宽；M/L/XL 在此基础上递增
export const KLINE_UNIT_SIZE_PRESETS: Record<UnitSize, { w: number; h: number; label: string }> = {
  S: { w: 8, h: 3, label: 'S' },
  M: { w: 10, h: 4, label: 'M' },
  L: { w: 12, h: 5, label: 'L' },
  XL: { w: 12, h: 6, label: 'XL' },
}

// 预测市场（market.prediction）专用尺寸：只保留 S/M
export const PREDICTION_UNIT_SIZE_PRESETS: Partial<Record<UnitSize, { w: number; h: number; label: string }>> = {
  S: { w: 6, h: 3, label: 'S' },
  M: { w: 6, h: 6, label: 'M' },
}

// 币股（market.crypto_stocks）专用尺寸：固定高度 h=3，宽度递增
export const CRYPTO_STOCKS_UNIT_SIZE_PRESETS: Record<UnitSize, { w: number; h: number; label: string }> = {
  S: { w: 6, h: 3, label: 'S' },
  M: { w: 8, h: 3, label: 'M' },
  L: { w: 10, h: 3, label: 'L' },
  XL: { w: 12, h: 3, label: 'XL' },
}

// 聚合多空比（derivatives.long_short_ratio）专用尺寸：只保留 S/M，M 针对 6 条数据优化
export const LONG_SHORT_UNIT_SIZE_PRESETS: Partial<Record<UnitSize, { w: number; h: number; label: string }>> = {
  S: { w: 6, h: 3, label: 'S' },
  M: { w: 6, h: 4, label: 'M' }, // Height adjusted to 4 as requested
}

// 聚合挂单（derivatives.orderbook_agg）专用尺寸：只保留 S/M，M 针对数据优化
export const ORDERBOOK_UNIT_SIZE_PRESETS: Partial<Record<UnitSize, { w: number; h: number; label: string }>> = {
  S: { w: 8, h: 3, label: 'S' },
  M: { w: 10, h: 4, label: 'M' },
}

// 聚合持仓量（derivatives.open_interest_agg）专用尺寸：只保留 S/M，M 针对数据优化
export const OPEN_INTEREST_UNIT_SIZE_PRESETS: Partial<Record<UnitSize, { w: number; h: number; label: string }>> = {
  S: { w: 8, h: 3, label: 'S' },
  M: { w: 10, h: 4, label: 'M' },
}

// 聚合成交量（derivatives.volume_agg）专用尺寸：只保留 S/M
export const VOLUME_UNIT_SIZE_PRESETS: Partial<Record<UnitSize, { w: number; h: number; label: string }>> = {
  S: { w: 6, h: 3, label: 'S' },
  M: { w: 6, h: 6, label: 'M' },
}

export function snapToPreset(w: number, h: number): { w: number; h: number; size: UnitSize } {
  const entries = Object.entries(UNIT_SIZE_PRESETS) as Array<[UnitSize, { w: number; h: number }]>

  let best: { size: UnitSize; w: number; h: number; score: number } | null = null
  for (const [size, p] of entries) {
    const score = Math.abs(p.w - w) + Math.abs(p.h - h)
    if (!best || score < best.score) best = { size, w: p.w, h: p.h, score }
  }
  // Should never be null, but keep safe fallback.
  return best ? { w: best.w, h: best.h, size: best.size } : { w: UNIT_SIZE_PRESETS.M.w, h: UNIT_SIZE_PRESETS.M.h, size: 'M' }
}

export function snapToPresetForWidgetType(
  widgetType: string | undefined,
  w: number,
  h: number,
): { w: number; h: number; size: UnitSize } {
  let presets: Record<string, { w: number; h: number; label: string }> = UNIT_SIZE_PRESETS

  if (widgetType === 'market.kline') {
    presets = KLINE_UNIT_SIZE_PRESETS
  } else if (widgetType === 'market.prediction') {
    presets = PREDICTION_UNIT_SIZE_PRESETS as any
  } else if (widgetType === 'market.crypto_stocks') {
    presets = CRYPTO_STOCKS_UNIT_SIZE_PRESETS
  } else if (widgetType === 'derivatives.long_short_ratio') {
    presets = LONG_SHORT_UNIT_SIZE_PRESETS as any
  } else if (widgetType === 'derivatives.orderbook_agg') {
    presets = ORDERBOOK_UNIT_SIZE_PRESETS
  } else if (widgetType === 'derivatives.open_interest_agg') {
    presets = OPEN_INTEREST_UNIT_SIZE_PRESETS as any
  } else if (widgetType === 'derivatives.volume_agg') {
    presets = VOLUME_UNIT_SIZE_PRESETS as any
  }

  const entries = Object.entries(presets) as Array<[UnitSize, { w: number; h: number }]>

  let best: { size: UnitSize; w: number; h: number; score: number } | null = null
  for (const [size, p] of entries) {
    const score = Math.abs(p.w - w) + Math.abs(p.h - h)
    if (!best || score < best.score) best = { size, w: p.w, h: p.h, score }
  }
  
  // Safe fallback to 'M' if best is found, otherwise default to first available
  if (best) return { w: best.w, h: best.h, size: best.size }
  
  // Fallback for prediction market (if M exists) or default M
  const fallback = presets['M'] || presets['S'] || UNIT_SIZE_PRESETS.M
  return { w: fallback.w, h: fallback.h, size: (presets['M'] ? 'M' : 'S') as UnitSize }
}
