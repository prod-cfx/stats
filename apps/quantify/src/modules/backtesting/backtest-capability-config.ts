import { MARKET_TIMEFRAMES } from '@ai/shared'
import type { EnvAccessor } from '@/common/env/env.accessor'
import { defaultEnvAccessor } from '@/common/env/env.accessor'

export interface BacktestCapabilitiesConfigRecord {
  allowedSymbols?: unknown
  allowedBaseTimeframes?: unknown
}

export interface NormalizedBacktestCapabilitiesConfig {
  allowedBaseTimeframes: string[]
}

export interface ResolvedBacktestCapabilitiesConfig {
  allowedSymbols: string[]
  allowedBaseTimeframes: string[]
}

export const BACKTEST_CAPABILITY_ALLOWED_SYMBOLS_ENV = 'BACKTEST_CAPABILITY_ALLOWED_SYMBOLS'
export const BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV = 'BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES'
export const DEFAULT_BACKTEST_CAPABILITY_SYMBOLS = ['BTCUSDT'] as const
export const DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES = MARKET_TIMEFRAMES
const SUPPORTED_BACKTEST_CAPABILITY_BASE_TIMEFRAME_SET = new Set<string>(MARKET_TIMEFRAMES)
const LEGACY_DEFAULT_BACKTEST_CAPABILITY_SYMBOLS = ['BTCUSDT'] as const
const LEGACY_DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES = ['15m', '1h'] as const

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

function normalizeConfiguredBacktestCapabilityTimeframes(raw: unknown): string[] | null {
  const normalized = normalizeConfiguredStringArray(raw)
  if (!normalized) {
    return null
  }

  return normalized.every(item => SUPPORTED_BACKTEST_CAPABILITY_BASE_TIMEFRAME_SET.has(item))
    ? normalized
    : null
}

function resolveConfiguredBacktestCapabilityTimeframes(raw: string | undefined): string[] | null {
  const parsed = parseConfiguredStringArray(raw)
  if (!parsed) {
    return null
  }

  const valid = parsed.filter(item => SUPPORTED_BACKTEST_CAPABILITY_BASE_TIMEFRAME_SET.has(item))
  const invalid = parsed.filter(item => !SUPPORTED_BACKTEST_CAPABILITY_BASE_TIMEFRAME_SET.has(item))

  if (invalid.length > 0 && valid.length === 0) {
    throw new Error(
      `Invalid ${BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV}: ${invalid.join(', ')}`,
    )
  }

  return valid.length > 0 ? valid : null
}

export function isLegacyDefaultBacktestCapabilityConfig(
  config: BacktestCapabilitiesConfigRecord | null | undefined,
): boolean {
  if (!config) {
    return false
  }

  const allowedSymbols = normalizeConfiguredStringArray(config.allowedSymbols)
  const allowedBaseTimeframes = normalizeConfiguredBacktestCapabilityTimeframes(config.allowedBaseTimeframes)
  if (!allowedSymbols || !allowedBaseTimeframes) {
    return false
  }

  return allowedSymbols.length === LEGACY_DEFAULT_BACKTEST_CAPABILITY_SYMBOLS.length
    && allowedSymbols.every((item, index) => item === LEGACY_DEFAULT_BACKTEST_CAPABILITY_SYMBOLS[index])
    && allowedBaseTimeframes.length === LEGACY_DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES.length
    && allowedBaseTimeframes.every((item, index) => item === LEGACY_DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES[index])
}

export function normalizeBacktestCapabilityConfig(
  config: BacktestCapabilitiesConfigRecord | null | undefined,
): NormalizedBacktestCapabilitiesConfig | null {
  if (!config) {
    return null
  }

  const allowedBaseTimeframes = normalizeConfiguredBacktestCapabilityTimeframes(config.allowedBaseTimeframes)

  if (!allowedBaseTimeframes) {
    return null
  }

  return {
    allowedBaseTimeframes,
  }
}

export function resolveConfiguredBacktestCapabilityConfig(
  env?: EnvAccessor | NodeJS.ProcessEnv,
): ResolvedBacktestCapabilitiesConfig {
  const read = (key: string): string | undefined => {
    if (!env) {
      return defaultEnvAccessor.raw(key)
    }

    if ('raw' in env && typeof env.raw === 'function') {
      return env.raw(key)
    }

    return env[key]
  }

  const allowedSymbols = parseConfiguredStringArray(read(BACKTEST_CAPABILITY_ALLOWED_SYMBOLS_ENV))
    ?? [...DEFAULT_BACKTEST_CAPABILITY_SYMBOLS]
  const allowedBaseTimeframes = resolveConfiguredBacktestCapabilityTimeframes(
    read(BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV),
  )
    ?? [...DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES]

  return {
    allowedSymbols,
    allowedBaseTimeframes,
  }
}
