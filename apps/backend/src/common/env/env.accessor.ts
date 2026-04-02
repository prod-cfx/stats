export type AppEnv = 'development' | 'test' | 'e2e' | 'staging' | 'production'

export type EnvRecord = Record<string, string | undefined>

export interface EnvAccessor {
  appEnv: () => AppEnv
  nodeEnv: () => string
  str: (key: string, defaultValue?: string) => string | undefined
  bool: (key: string, defaultValue?: boolean) => boolean
  int: (key: string, defaultValue?: number) => number
  raw: (key: string) => string | undefined
  snapshot: () => EnvRecord
}

type EnvSource = EnvRecord | NodeJS.ProcessEnv | undefined

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])
const FALSE_VALUES = new Set(['false', '0', 'no', 'off'])

function resolveEnv(source?: EnvSource): EnvRecord {
  if (source) {
    return source as EnvRecord
  }

  if (typeof globalThis === 'object') {
    const maybeProcess = (globalThis as Record<string, unknown>).process as NodeJS.Process | undefined
    if (maybeProcess?.env) {
      return maybeProcess.env as EnvRecord
    }
  }

  return {}
}

function writeProcessEnv(key: string, value: string | undefined): void {
  const env = resolveEnv()
  if (value === undefined) {
    delete env[key]
    return
  }

  env[key] = value
}

export function normalizeAppEnv(value: string | undefined): AppEnv {
  const normalized = (value || 'development').toLowerCase()
  switch (normalized) {
    case 'prod':
    case 'production':
      return 'production'
    case 'stage':
    case 'staging':
      return 'staging'
    case 'test':
      return 'test'
    case 'e2e':
      return 'e2e'
    case 'dev':
    case 'development':
    default:
      return 'development'
  }
}

function computeAppEnv(source?: EnvSource): AppEnv {
  const env = resolveEnv(source)
  return normalizeAppEnv(env.APP_ENV || env.NODE_ENV || 'development')
}

function getString(key: string, defaultValue: string | undefined, env: EnvRecord): string | undefined {
  if (env[key] === undefined) {
    return defaultValue
  }
  return env[key]
}

function getBoolean(key: string, defaultValue: boolean, env: EnvRecord): boolean {
  const value = env[key]
  if (value === undefined) {
    return defaultValue
  }
  const normalized = value.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) {
    return true
  }
  if (FALSE_VALUES.has(normalized)) {
    return false
  }
  return defaultValue
}

function getInt(key: string, defaultValue: number | undefined, env: EnvRecord): number {
  const value = env[key]
  if (value === undefined) {
    return defaultValue ?? Number.NaN
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return defaultValue ?? Number.NaN
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function setProcessEnvValue(key: string, value: string | undefined): void {
  writeProcessEnv(key, value)
}

export function ensureProcessEnvDefaults(defaults: Record<string, string>): void {
  const env = resolveEnv()
  for (const [key, value] of Object.entries(defaults)) {
    if (!env[key]) {
      env[key] = value
    }
  }
}

export function snapshotProcessEnv(keys: readonly string[]): EnvRecord {
  const env = resolveEnv()

  return Object.fromEntries(keys.map(key => [key, env[key]]))
}

export function restoreProcessEnv(snapshot: EnvRecord): void {
  for (const [key, value] of Object.entries(snapshot)) {
    writeProcessEnv(key, value)
  }
}

export function createEnvAccessor(source?: EnvSource): EnvAccessor {
  const env = resolveEnv(source)

  return {
    appEnv(): AppEnv {
      return computeAppEnv(env)
    },
    nodeEnv(): string {
      return (env.NODE_ENV || 'development').toLowerCase()
    },
    str(key: string, defaultValue?: string): string | undefined {
      return getString(key, defaultValue, env)
    },
    bool(key: string, defaultValue = false): boolean {
      return getBoolean(key, defaultValue, env)
    },
    int(key: string, defaultValue?: number): number {
      return getInt(key, defaultValue, env)
    },
    raw(key: string): string | undefined {
      return env[key]
    },
    snapshot(): EnvRecord {
      return { ...env }
    },
  }
}

export const defaultEnvAccessor = createEnvAccessor()
