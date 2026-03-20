export type AppEnv = 'development' | 'production' | 'test' | 'e2e' | 'staging'

export type EnvRecord = Record<string, string | undefined>

const APP_ENV_VALUES: AppEnv[] = ['development', 'production', 'test', 'e2e', 'staging']

function resolveEnv(env?: EnvRecord): EnvRecord {
  if (env) return env
  const globalObj: any = typeof globalThis === 'object' ? globalThis : undefined
  const processEnv = globalObj?.process?.env
  if (processEnv && typeof processEnv === 'object') {
    return processEnv as EnvRecord
  }
  return {}
}

export function computeAppEnv(raw?: string | null, env?: EnvRecord): AppEnv {
  const source = resolveEnv(env)
  const candidate = raw ?? source.APP_ENV ?? source.NODE_ENV ?? 'development'
  const normalized = String(candidate || '').toLowerCase()
  return APP_ENV_VALUES.includes(normalized as AppEnv) ? (normalized as AppEnv) : 'development'
}

export function getAppEnv(env?: EnvRecord): AppEnv {
  return computeAppEnv(undefined, env)
}

export function getString(key: string, defaultValue?: string, env?: EnvRecord): string | undefined {
  const source = resolveEnv(env)
  const value = source[key]
  if (value === undefined || value === null) return defaultValue
  const str = String(value)
  return str.length > 0 ? str : defaultValue
}

export function getBoolean(key: string, defaultValue = false, env?: EnvRecord): boolean {
  const raw = getString(key, undefined, env)
  if (raw === undefined) return defaultValue
  const normalized = raw.trim().toLowerCase()
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
}

export function getNumber(key: string, defaultValue?: number, env?: EnvRecord): number {
  const raw = getString(key, undefined, env)
  if (raw === undefined) return defaultValue as number
  const n = Number(raw)
  return Number.isFinite(n) ? n : (defaultValue as number)
}

export function getInt(key: string, defaultValue?: number, env?: EnvRecord): number {
  const raw = getString(key, undefined, env)
  if (raw === undefined) return defaultValue as number
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : (defaultValue as number)
}

export function isProd(env?: EnvRecord): boolean {
  return getAppEnv(env) === 'production'
}

export function isDev(env?: EnvRecord): boolean {
  return getAppEnv(env) === 'development'
}

export function isTest(env?: EnvRecord): boolean {
  return getAppEnv(env) === 'test'
}

export function isE2E(env?: EnvRecord): boolean {
  return getAppEnv(env) === 'e2e'
}

export function isStaging(env?: EnvRecord): boolean {
  return getAppEnv(env) === 'staging'
}

export function isAdminDebugEnabled(env?: EnvRecord): boolean {
  return !isProd(env) || getBoolean('DEBUG_MODE', false, env)
}

export const EnvCore = {
  computeAppEnv,
  getAppEnv,
  getString,
  getNumber,
  getInt,
  getBoolean,
  isProd,
  isDev,
  isTest,
  isE2E,
  isStaging,
  isAdminDebugEnabled,
}
