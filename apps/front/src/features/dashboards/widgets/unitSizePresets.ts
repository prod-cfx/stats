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
  const presets = widgetType === 'market.kline' ? KLINE_UNIT_SIZE_PRESETS : UNIT_SIZE_PRESETS
  const entries = Object.entries(presets) as Array<[UnitSize, { w: number; h: number }]>

  let best: { size: UnitSize; w: number; h: number; score: number } | null = null
  for (const [size, p] of entries) {
    const score = Math.abs(p.w - w) + Math.abs(p.h - h)
    if (!best || score < best.score) best = { size, w: p.w, h: p.h, score }
  }
  return best ? { w: best.w, h: best.h, size: best.size } : { w: presets.M.w, h: presets.M.h, size: 'M' }
}
