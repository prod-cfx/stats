import type { EnvService } from '../common/services/env.service'
import * as winston from 'winston'
import { defaultEnvAccessor } from '../common/env/env.accessor'

export interface LoggerConfig {
  level: string
  contextFilter: string[]
}

function parseContextFilter(): string[] {
  const filter = defaultEnvAccessor.str('LOG_CONTEXT_FILTER')?.trim()
  if (!filter) {
    return []
  }
  return filter
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
}

export function resolveLoggerConfig(): LoggerConfig {
  const appEnv = defaultEnvAccessor.appEnv()
  const defaultLevel = appEnv === 'production' ? 'warn' : 'debug'

  return {
    level: defaultEnvAccessor.str('LOG_LEVEL', defaultLevel) || defaultLevel,
    contextFilter: parseContextFilter(),
  }
}

function createContextFilter(contextFilter: string[]) {
  return winston.format(info => {
    if (contextFilter.length === 0) {
      return info
    }

    if (!info.context) {
      return info
    }

    if (contextFilter.includes(info.context as string)) {
      return info
    }

    return false
  })()
}

export function createWinstonTransports(
  config: LoggerConfig = resolveLoggerConfig(),
  envService?: EnvService,
): winston.transport[] {
  const appEnv = defaultEnvAccessor.appEnv()
  const isProd = envService ? envService.isProd() : appEnv === 'production' || appEnv === 'staging'
  const isE2E = envService ? envService.isE2E() : appEnv === 'e2e' || appEnv === 'test'

  if (isE2E) {
    return [
      new winston.transports.Console({
        level: 'error',
        silent: true,
      }),
    ]
  }

  if (isProd) {
    return [
      new winston.transports.Console({
        level: config.level,
        format: winston.format.combine(
          createContextFilter(config.contextFilter),
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    ]
  }

  return [
    new winston.transports.Console({
      level: config.level,
      format: winston.format.combine(
        createContextFilter(config.contextFilter),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ all: true }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
          let output = `${timestamp} ${level}: `

          if (context) {
            output += `[${context}] `
          }

          output += message

          if (stack) {
            output += `\n${stack}`
          }

          const metaKeys = Object.keys(meta)
          if (metaKeys.length > 0) {
            const filteredMeta: Record<string, unknown> = {}
            metaKeys.forEach(key => {
              if (key !== 'ms' && meta[key] !== undefined) {
                filteredMeta[key] = meta[key]
              }
            })

            if (Object.keys(filteredMeta).length > 0) {
              output += `\n${JSON.stringify(filteredMeta, null, 2)}`
            }
          }

          return output
        }),
      ),
    }),
  ]
}


