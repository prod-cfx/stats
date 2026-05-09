import type { Bar } from '../helpers'

export type LiquiditySweepDirection = 'bullish' | 'bearish'
export type LiquiditySweepReference = 'prev_low' | 'prev_high' | 'session_low' | 'session_high'

export interface LiquiditySweepDetectorInput {
  bars: readonly Partial<Bar>[]
  direction: string | null | undefined
  reference: string | null | undefined
  reclaimBars?: number | null
  timezone?: string | null
}

type SweepSide = 'low' | 'high'

interface NormalizedBar {
  open: number
  high: number
  low: number
  close: number
  timestamp: number
}

export function liquiditySweepDetector(input: LiquiditySweepDetectorInput): boolean {
  const direction = normalizeDirection(input.direction)
  const reference = normalizeReference(input.reference)
  if (!direction || !reference || !isNaturalSweepCombination(direction, reference)) return false

  const reclaimBars = normalizeReclaimBars(input.reclaimBars)
  if (reclaimBars === null) return false

  const bars = input.bars.map(normalizeBar).filter((bar): bar is NormalizedBar => bar !== null)
  if (bars.length < 2) return false

  const currentIndex = bars.length - 1
  const side = reference.endsWith('_low') ? 'low' : 'high'
  if (!closesBackToSameSide(bars[currentIndex]!, side, null)) return false

  const firstCandidateIndex = Math.max(1, currentIndex - reclaimBars)
  for (let sweepIndex = currentIndex; sweepIndex >= firstCandidateIndex; sweepIndex -= 1) {
    const level = resolveReferenceLevel(bars, sweepIndex, reference, input.timezone ?? 'UTC')
    if (level === null) continue
    if (!wickPenetrates(bars[sweepIndex]!, level, side)) continue
    if (currentIndex - sweepIndex > reclaimBars) continue
    if (!closesBackToSameSide(bars[currentIndex]!, side, level)) continue
    if (hasEarlierReclaim(bars, sweepIndex, currentIndex, side, level)) continue
    return true
  }

  return false
}

export function isNaturalSweepCombination(
  direction: LiquiditySweepDirection,
  reference: LiquiditySweepReference,
): boolean {
  return (direction === 'bullish' && (reference === 'prev_low' || reference === 'session_low'))
    || (direction === 'bearish' && (reference === 'prev_high' || reference === 'session_high'))
}

function normalizeDirection(value: string | null | undefined): LiquiditySweepDirection | null {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'bullish' || normalized === 'bearish' ? normalized : null
}

function normalizeReference(value: string | null | undefined): LiquiditySweepReference | null {
  const normalized = value?.trim().toLowerCase()
  if (
    normalized === 'prev_low'
    || normalized === 'prev_high'
    || normalized === 'session_low'
    || normalized === 'session_high'
  ) {
    return normalized
  }
  return null
}

function normalizeReclaimBars(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return 3
  return Number.isInteger(value) && value >= 0 ? value : null
}

function normalizeBar(bar: Partial<Bar>): NormalizedBar | null {
  const timestamp = readTimestamp(bar)
  if (
    !isFiniteNumber(bar.open)
    || !isFiniteNumber(bar.high)
    || !isFiniteNumber(bar.low)
    || !isFiniteNumber(bar.close)
    || timestamp === null
  ) {
    return null
  }

  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    timestamp,
  }
}

function readTimestamp(bar: Partial<Bar>): number | null {
  if (isFiniteNumber(bar.timestamp)) return bar.timestamp
  const legacyTime = (bar as { time?: unknown }).time
  if (isFiniteNumber(legacyTime)) return legacyTime
  if (legacyTime instanceof Date && Number.isFinite(legacyTime.getTime())) return legacyTime.getTime()
  if (typeof legacyTime === 'string') {
    const parsed = Date.parse(legacyTime)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function resolveReferenceLevel(
  bars: readonly NormalizedBar[],
  sweepIndex: number,
  reference: LiquiditySweepReference,
  timezone: string,
): number | null {
  const previousBar = bars[sweepIndex - 1]
  if (!previousBar) return null

  if (reference === 'prev_low') return previousBar.low
  if (reference === 'prev_high') return previousBar.high

  const sessionKey = sessionDateKey(bars[sweepIndex]!.timestamp, timezone)
  const sessionBars = bars.slice(0, sweepIndex).filter(bar => sessionDateKey(bar.timestamp, timezone) === sessionKey)
  if (sessionBars.length === 0) return null

  if (reference === 'session_low') return Math.min(...sessionBars.map(bar => bar.low))
  return Math.max(...sessionBars.map(bar => bar.high))
}

function wickPenetrates(bar: NormalizedBar, level: number, side: SweepSide): boolean {
  return side === 'low' ? bar.low < level : bar.high > level
}

function closesBackToSameSide(bar: NormalizedBar, side: SweepSide, level: number | null): boolean {
  if (level === null) return true
  return side === 'low' ? bar.close > level : bar.close < level
}

function hasEarlierReclaim(
  bars: readonly NormalizedBar[],
  sweepIndex: number,
  currentIndex: number,
  side: SweepSide,
  level: number,
): boolean {
  for (let index = sweepIndex; index < currentIndex; index += 1) {
    if (closesBackToSameSide(bars[index]!, side, level)) return true
  }
  return false
}

function sessionDateKey(timestamp: number, timezone: string): string {
  const timeZone = timezone.trim() || 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(timestamp))
    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    const day = parts.find(part => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // Invalid user-provided timezone fails closed to UTC session grouping.
  }

  const date = new Date(timestamp)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
