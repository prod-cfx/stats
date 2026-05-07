/**
 * Timezone clock helper for Phase 1 strategy.time_window gate.
 *
 * Pure function: 把 epoch ms / second 时间戳转成指定 IANA 时区的 wall clock。
 * 不调 Date.now()；不依赖任何 IO；缓存 Intl.DateTimeFormat 实例避免高频构造。
 */

export class InvalidTimezoneError extends Error {
  override readonly name = 'InvalidTimezoneError'
  constructor(timezone: string, cause?: unknown) {
    super(`invalid IANA timezone: ${timezone}`)
    if (cause !== undefined) {
      ;(this as { cause?: unknown }).cause = cause
    }
  }
}

export interface WallClockResult {
  hours: number
  minutes: number
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday (与 JS Date.getDay 对齐) */
  dayOfWeek: number
}

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = FORMATTER_CACHE.get(timezone)
  if (cached) {
    return cached
  }
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
  }
  catch (cause) {
    throw new InvalidTimezoneError(timezone, cause)
  }
  FORMATTER_CACHE.set(timezone, formatter)
  return formatter
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function normalizeTimestampMs(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp
}

export function getWallClock(timestamp: number, timezone: string): WallClockResult {
  if (!Number.isFinite(timestamp)) {
    return { hours: NaN, minutes: NaN, dayOfWeek: NaN }
  }
  const formatter = getFormatter(timezone)
  const ms = normalizeTimestampMs(timestamp)
  const date = new Date(ms)
  const parts = formatter.formatToParts(date)
  let hours = NaN
  let minutes = NaN
  let weekdayKey = ''
  for (const part of parts) {
    if (part.type === 'hour') {
      const numeric = Number.parseInt(part.value, 10)
      hours = numeric === 24 ? 0 : numeric
    }
    else if (part.type === 'minute') {
      minutes = Number.parseInt(part.value, 10)
    }
    else if (part.type === 'weekday') {
      weekdayKey = part.value
    }
  }
  const dayOfWeek = WEEKDAY_TO_INDEX[weekdayKey]
  if (dayOfWeek === undefined) {
    throw new InvalidTimezoneError(timezone)
  }
  return { hours, minutes, dayOfWeek }
}

interface TimeWindow {
  daysOfWeek?: readonly number[]
  start: string
  end: string
}

function parseHHmm(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const hours = Number.parseInt(match[1] as string, 10)
  const minutes = Number.parseInt(match[2] as string, 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return { hours, minutes }
}

export function isWithinTimeWindow(
  timestamp: number,
  timezone: string,
  windows: readonly TimeWindow[],
): boolean {
  if (!Array.isArray(windows) || windows.length === 0) {
    return false
  }
  const wall = getWallClock(timestamp, timezone)
  if (!Number.isFinite(wall.hours) || !Number.isFinite(wall.minutes)) {
    return false
  }
  const minutesOfDay = wall.hours * 60 + wall.minutes
  for (const window of windows) {
    if (window.daysOfWeek && !window.daysOfWeek.includes(wall.dayOfWeek)) {
      continue
    }
    const start = parseHHmm(window.start)
    const end = parseHHmm(window.end)
    if (!start || !end) {
      continue
    }
    const startMin = start.hours * 60 + start.minutes
    const endMin = end.hours * 60 + end.minutes
    if (startMin <= endMin) {
      if (minutesOfDay >= startMin && minutesOfDay < endMin) {
        return true
      }
    }
    else if (minutesOfDay >= startMin || minutesOfDay < endMin) {
      return true
    }
  }
  return false
}
