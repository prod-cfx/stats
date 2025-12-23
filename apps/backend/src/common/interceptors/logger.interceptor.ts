import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import { Inject, Injectable, Logger } from '@nestjs/common'
import chalk from 'chalk'
import { catchError, tap } from 'rxjs/operators'
// Nest 依赖运行时类型元数据，需保留值导入
 
import { EnvService } from '../services/env.service'

@Injectable()
export class LoggerInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly logger = new Logger(LoggerInterceptor.name)
  // thresholds
  private static readonly BODY_SIZE_THRESHOLD = 512
  private static readonly BODY_KEY_COUNT_THRESHOLD = 50
  private static readonly TRUNCATE_LENGTH = 1000
  private static readonly MAX_OBJECT_KEYS = 100
  private static readonly MAX_ARRAY_ITEMS = 100
  private static readonly MAX_DEPTH = 5

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.env.isE2E()) {
      return next.handle()
    }

    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    if (request.url?.includes('/stream')) {
      return next.handle()
    }

    if (this.env.isProd()) {
      return this.handleProductionLogging(context, next)
    }
    return this.handleDevelopmentLogging(context, next)
  }

  private handleProductionLogging(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now()
    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now
        let bodySize: number | string
        const body = request.body

        if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
          bodySize = 0
        } else if (typeof body !== 'object') {
          bodySize = String(body).length
        } else {
          const keyCount = Object.keys(body).length
          if (keyCount > LoggerInterceptor.BODY_KEY_COUNT_THRESHOLD) {
            bodySize = `>${LoggerInterceptor.BODY_SIZE_THRESHOLD}`
          } else {
            try {
              const bodyStr = JSON.stringify(body)
              const actualSize = Buffer.byteLength(bodyStr, 'utf8')
              bodySize = actualSize > LoggerInterceptor.BODY_SIZE_THRESHOLD ? `${actualSize}` : actualSize
            } catch {
              bodySize = 'unstringifiable'
            }
          }
        }

        const logData = {
          method: request.method,
          path: request.url,
          statusCode: response.statusCode,
          duration: `${duration}ms`,
          traceId: request.headers['x-request-id'] || 'N/A',
          bodySize,
        }

        this.logger.log(logData)
      }),
      catchError(error => {
        const duration = Date.now() - now
        const statusCode = error.status || 500
        const errorData = {
          method: request.method,
          path: request.url,
          statusCode,
          duration: `${duration}ms`,
          traceId: request.headers['x-request-id'] || 'N/A',
          message: error.message,
          stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace',
        }

        this.logger.error(errorData)
        throw error
      }),
    )
  }

  private handleDevelopmentLogging(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now()
    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    const requestMethod = chalk.bold.blue(request.method)
    const requestUrl = chalk.bold.green(request.originalUrl || request.url)
    const safeHeaders = this.sanitizeObject(request.headers, true, LoggerInterceptor.MAX_DEPTH)
    const safeBody = this.sanitizeObject(request.body, false, LoggerInterceptor.MAX_DEPTH)
    const safeQuery = this.sanitizeObject(request.query, false, LoggerInterceptor.MAX_DEPTH)
    this.logger.log(
      `\n${chalk.cyan.bold('=== Request ===')}\n${chalk.blue('->')} ${requestMethod} ${requestUrl}\n${chalk.yellow('Headers:')} ${chalk.gray(this.truncateObject(safeHeaders))}\n${chalk.yellow('Body:')} ${chalk.gray(this.truncateObject(safeBody))}\n${chalk.yellow('Query:')} ${chalk.gray(this.truncateObject(safeQuery))}\n${chalk.cyan.bold('===============')}`,
    )

    return next.handle().pipe(
      tap(data => {
        const delay = Date.now() - now
        const statusColor = this.getStatusColor(response.statusCode)
        const safeRespBody = this.sanitizeObject(data, false, LoggerInterceptor.MAX_DEPTH)
        this.logger.log(
          `\n${chalk.cyan.bold('=== Response ===')}\n${chalk.blue('->')} ${requestMethod} ${requestUrl}\n${statusColor(`${response.statusCode}`)} ${chalk.magenta(`${delay}ms`)}\n${chalk.yellow('Body:')} ${chalk.gray(this.truncateObject(safeRespBody))}\n${chalk.cyan.bold('================')}`,
        )
      }),
      catchError(error => {
        const delay = Date.now() - now
        const statusCode = error.status || 500
        const statusColor = this.getStatusColor(statusCode)
        this.logger.error(
          `\n${chalk.red.bold('=== Error ===')}\n${chalk.blue('->')} ${requestMethod} ${requestUrl}\n${statusColor(`${statusCode}`)} ${chalk.magenta(`${delay}ms`)}\n${chalk.yellow('Message:')} ${chalk.red(error.message)}\n${chalk.yellow('Stack:')} ${chalk.gray(error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace')}\n${chalk.red.bold('=============')}`,
        )
        throw error
      }),
    )
  }

  private getStatusColor(status: number): (text: string) => string {
    if (status >= 500) return chalk.red.bold
    if (status >= 400) return chalk.yellow.bold
    if (status >= 300) return chalk.cyan.bold
    if (status >= 200) return chalk.green.bold
    return chalk.white
  }

  private truncateObject(obj: unknown): string {
    if (!obj) return 'null'
    try {
      const str = JSON.stringify(obj)
      return str.length > LoggerInterceptor.TRUNCATE_LENGTH
        ? `${str.substring(0, LoggerInterceptor.TRUNCATE_LENGTH)}... (truncated)`
        : str
    } catch {
      return '[Object cannot be stringified]'
    }
  }

  private sanitizeObject(input: unknown, isHeader = false, maxDepth = LoggerInterceptor.MAX_DEPTH): unknown {
    if (!input || typeof input !== 'object') return input
    const sensitiveHeaderKeys = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'])
    const sensitiveFieldKeys = new Set([
      'password',
      'pass',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'email',
      'phone',
      'mobile',
      'code',
      'verificationCode',
    ])

    const maskString = (v: string) => {
      if (!v) return v
      if (v.length <= 8) return '*'.repeat(Math.max(0, v.length - 2)) + v.slice(-2)
      return `${v.slice(0, 4)}****${v.slice(-4)}`
    }

    const maskEmail = (v: string) => {
      const idx = v.indexOf('@')
      if (idx <= 1) return `*${v.slice(idx)}`
      return `${v[0]}****${v.slice(idx)}`
    }

    const maskPhone = (v: string) => {
      const digits = v.replace(/\D/g, '')
      if (digits.length < 7) return maskString(v)
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`
    }

    const walker = (obj: unknown, depth: number): unknown => {
      if (depth <= 0) return '[Max depth reached]'
      if (Array.isArray(obj)) {
        return obj.slice(0, LoggerInterceptor.MAX_ARRAY_ITEMS).map(item => walker(item, depth - 1))
      }
      if (obj && typeof obj === 'object') {
        const out: Record<string, unknown> = {}
        let count = 0
        for (const [key, rawVal] of Object.entries(obj)) {
          if (++count > LoggerInterceptor.MAX_OBJECT_KEYS) {
            out['...'] = `[${Object.keys(obj).length - LoggerInterceptor.MAX_OBJECT_KEYS} more keys]`
            break
          }
          const k = key.toLowerCase()
          const val = rawVal
          if (val && typeof val === 'object') {
            out[key] = walker(val, depth - 1)
            continue
          }
          if ((isHeader && sensitiveHeaderKeys.has(k)) || sensitiveFieldKeys.has(key)) {
            const strVal = String(val ?? '')
            if (k === 'authorization') out[key] = maskString(strVal)
            else if (key === 'email') out[key] = maskEmail(strVal)
            else if (key === 'phone' || key === 'mobile') out[key] = maskPhone(strVal)
            else out[key] = maskString(strVal)
          } else {
            out[key] = val
          }
        }
        return out
      }
      return obj
    }

    return walker(input, maxDepth)
  }
}
