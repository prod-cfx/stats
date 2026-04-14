import { MARKET_TIMEFRAMES } from '@ai/shared'
import type { EnvAccessor } from '@/common/env/env.accessor'
import { defaultEnvAccessor } from '@/common/env/env.accessor'

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

function isLegacyDefaultBacktestCapabilityConfig(input: {
  allowedSymbols: readonly string[]
  allowedBaseTimeframes: readonly string[]
}): boolean {
  return input.allowedSymbols.length === LEGACY_DEFAULT_BACKTEST_CAPABILITY_SYMBOLS.length
    && input.allowedSymbols.every((item, index) => item === LEGACY_DEFAULT_BACKTEST_CAPABILITY_SYMBOLS[index])
    && input.allowedBaseTimeframes.length === LEGACY_DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES.length
    && input.allowedBaseTimeframes.every((item, index) => item === LEGACY_DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES[index])
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

export function normalizeBacktestCapabilityConfig(
  config: BacktestCapabilitiesConfigRecord | null | undefined,
): NormalizedBacktestCapabilitiesConfig | null {
  if (!config) {
    return null
  }

  const allowedSymbols = normalizeConfiguredStringArray(config.allowedSymbols)
  const allowedBaseTimeframes = normalizeConfiguredBacktestCapabilityTimeframes(config.allowedBaseTimeframes)

  if (!allowedSymbols || !allowedBaseTimeframes) {
    return null
  }

  return {
    allowedSymbols,
    allowedBaseTimeframes: isLegacyDefaultBacktestCapabilityConfig({
      allowedSymbols,
      allowedBaseTimeframes,
    })
      ? [...DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES]
      : allowedBaseTimeframes,
  }
}

export function resolveConfiguredBacktestCapabilityConfig(
  env?: EnvAccessor | NodeJS.ProcessEnv,
): NormalizedBacktestCapabilitiesConfig {
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
  const allowedBaseTimeframes = normalizeConfiguredBacktestCapabilityTimeframes(
    parseConfiguredStringArray(read(BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES_ENV)),
  )
    ?? [...DEFAULT_BACKTEST_CAPABILITY_BASE_TIMEFRAMES]

  return {
    allowedSymbols,
    allowedBaseTimeframes,
  }
}
