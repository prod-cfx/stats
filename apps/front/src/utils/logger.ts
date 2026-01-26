const IS_DEV = process.env.NODE_ENV === 'development'

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (IS_DEV) {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (IS_DEV) {
      console.info(`[INFO] ${message}`, ...args)
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args)
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, error, ...args)
  },
}
