export type BacktestRangePreset = '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'

export interface BacktestRangeInput {
  preset: BacktestRangePreset
  startAt?: string
  endAt?: string
}

export interface BacktestRangeResolved {
  startAt: string
  endAt: string
}

export type BacktestRangeValidationReason = 'missing_range' | 'start_after_end' | 'range_too_large'

export type BacktestRangeValidationResult =
  | { ok: true }
  | { ok: false, reason: BacktestRangeValidationReason }

const MAX_RANGE_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000
const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': DAY_MS,
}

const PRESET_DAYS: Record<Exclude<BacktestRangePreset, 'CUSTOM'>, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
}

function parseDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIso(date: Date): string {
  return date.toISOString()
}

function alignToTimeframeBoundary(date: Date, timeframe?: string): Date {
  const timeframeMs = timeframe ? TIMEFRAME_MS[timeframe] : undefined
  if (!timeframeMs) {
    return new Date(date)
  }

  return new Date(Math.floor(date.getTime() / timeframeMs) * timeframeMs)
}

export function resolveBacktestRange(
  input: BacktestRangeInput,
  now = new Date(),
  baseTimeframe?: string,
): BacktestRangeResolved {
  if (input.preset !== 'CUSTOM') {
    const end = alignToTimeframeBoundary(new Date(now), baseTimeframe)
    const start = new Date(end.getTime() - PRESET_DAYS[input.preset] * DAY_MS)
    return {
      startAt: toIso(start),
      endAt: toIso(end),
    }
  }

  const start = parseDate(input.startAt) ?? new Date(now)
  const end = parseDate(input.endAt) ?? new Date(now)

  return {
    startAt: toIso(start),
    endAt: toIso(end),
  }
}

export function validateBacktestRange(input: BacktestRangeInput): BacktestRangeValidationResult {
  if (input.preset !== 'CUSTOM') {
    return { ok: true }
  }

  const start = parseDate(input.startAt)
  const end = parseDate(input.endAt)

  if (!start || !end) {
    return { ok: false, reason: 'missing_range' }
  }

  if (start.getTime() >= end.getTime()) {
    return { ok: false, reason: 'start_after_end' }
  }

  const diffDays = (end.getTime() - start.getTime()) / DAY_MS
  if (diffDays > MAX_RANGE_DAYS) {
    return { ok: false, reason: 'range_too_large' }
  }

  return { ok: true }
}
