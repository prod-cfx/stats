export type UnitSize = 'S' | 'M' | 'L' | 'XL'

export const UNIT_SIZE_PRESETS: Record<UnitSize, { w: number; h: number; label: string }> = {
  S: { w: 6, h: 6, label: 'S' },
  M: { w: 6, h: 8, label: 'M' },
  L: { w: 12, h: 10, label: 'L' },
  XL: { w: 12, h: 16, label: 'XL' },
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
