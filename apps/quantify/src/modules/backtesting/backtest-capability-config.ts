import type { EnvAccessor } from '@/common/env/env.accessor'

export interface BacktestCapabilitiesConfigRecord {
  allowedSymbols?: unknown
  allowedBaseTimeframes?: unknown
}

export interface NormalizedBacktestCapabilitiesConfig {
  allowedSymbols: string[]
  allowedBaseTimeframes: string[]
}

export const BACKTEST_CAPABILITY_ALLOWED_SYMBOLS_ENV = 'BACKTEST_CAPABILITY_ALLOWED_SYMBOLS'
export const BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV = 'BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES'
export const DEFAULT_BACKTEST_CAPABILITY_SYMBOLS = ['BTCUSDT'] as const
export const DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES = ['15m', '1h'] as const

function parseConfiguredStringArray(raw: string | undefined): string[] | null {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return null
  }

  const parsed = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(',')
  return normalizeConfiguredStringArray(parsed)
}

export function normalizeConfiguredStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  const normalized: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      return null
    }

    const value = item.trim()
    if (!value) {
      return null
    }

    normalized.push(value)
  }

  return normalized.length > 0 ? normalized : null
}

export function normalizeBacktestCapabilityConfig(
  config: BacktestCapabilitiesConfigRecord | null | undefined,
): NormalizedBacktestCapabilitiesConfig | null {
  if (!config) {
    return null
  }

  const allowedSymbols = normalizeConfiguredStringArray(config.allowedSymbols)
  const allowedBaseTimeframes = normalizeConfiguredStringArray(config.allowedBaseTimeframes)

  if (!allowedSymbols || !allowedBaseTimeframes) {
    return null
  }

  return {
    allowedSymbols,
    allowedBaseTimeframes,
  }
}

export function resolveConfiguredBacktestCapabilityConfig(
  env?: EnvAccessor | NodeJS.ProcessEnv,
): NormalizedBacktestCapabilitiesConfig {
  const read = (key: string): string | undefined => {
    if (!env) {
      return process.env[key]
    }

    if ('raw' in env && typeof env.raw === 'function') {
      return env.raw(key)
    }

    return env[key]
  }

  const allowedSymbols = parseConfiguredStringArray(read(BACKTEST_CAPABILITY_ALLOWED_SYMBOLS_ENV))
    ?? [...DEFAULT_BACKTEST_CAPABILITY_SYMBOLS]
  const allowedBaseTimeframes = parseConfiguredStringArray(read(BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV))
    ?? [...DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES]

  return {
    allowedSymbols,
    allowedBaseTimeframes,
  }
}
