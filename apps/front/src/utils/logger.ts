type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

const DEFAULT_LOG_LEVEL: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

function normalizeLogLevel(value: string | null | undefined): LogLevel | null {
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'silent') {
    return normalized
  }

  return null
}

function getLocalStorageLogLevel(): LogLevel | null {
  if (typeof window === 'undefined') return null

  try {
    return normalizeLogLevel(window.localStorage.getItem('logLevel'))
  } catch {
    return null
  }
}

function getConfiguredLogLevel(): LogLevel {
  return getLocalStorageLogLevel()
    ?? normalizeLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL)
    ?? DEFAULT_LOG_LEVEL
}

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getConfiguredLogLevel()]
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args)
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    if (!shouldLog('error')) return

    if (error === undefined) {
      console.error(`[ERROR] ${message}`, ...args)
      return
    }

    console.error(`[ERROR] ${message}`, error, ...args)
  },
}
