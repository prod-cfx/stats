import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { Catch, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { DomainException } from '../exceptions/domain.exception'
import { EnvService } from '../services/env.service'

// Prisma 7: 浣跨敤 Prisma namespace 璁块棶绫诲瀷鍜屽€?
/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

type ErrorArgs = Record<string, unknown> | undefined

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(@Inject(EnvService) private readonly env: EnvService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception instanceof Error ? exception : new Error(String(exception ?? 'Unknown exception'))
    }

    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    if (!response || !request) {
      throw exception
    }

    // 瀵逛簬宸茬粡寮€濮嬪彂閫佸搷搴旓紙濡?SSE 娴侊級鏃舵姏鍑虹殑寮傚父锛岄伩鍏嶅啀娆″啓鍏ュ搷搴斿ご/鍝嶅簲浣擄紝
    // 鍚﹀垯浼氳Е鍙?"Cannot set headers after they are sent to the client" 閿欒銆?
    if (response.headersSent) {
      this.logger.error(
        `Exception thrown after headers were sent on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      )
      // 鏄惧紡鍏抽棴鍝嶅簲锛岄伩鍏嶈繛鎺ユ偓鎸?
      // 浣跨敤 destroy() 鑰岄潪 end()锛屽洜涓哄搷搴斿ご宸插彂閫侊紝鏃犳硶姝ｅ父缁撴潫娴?
      try {
        response.destroy()
      } catch (destroyError) {
        this.logger.error(
          `Failed to destroy response after exception: ${destroyError instanceof Error ? destroyError.message : String(destroyError)}`,
        )
      }
      return
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      this.handlePrismaException(exception, request, response)
      return
    }

    const isHttpException = exception instanceof HttpException
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const requestId = this.ensureRequestId(request, response)
    const timestamp = new Date().toISOString()

    let code: ErrorCode | undefined
    let args: ErrorArgs
    let message: unknown = 'Internal Error'
    let rawResponse: unknown

    if (exception instanceof DomainException) {
      code = exception.code
      args = exception.args
      message = exception.message
    } else if (isHttpException) {
      const httpException = exception as HttpException
      rawResponse = httpException.getResponse()
      message = this.extractHttpMessage(rawResponse, httpException.message)

      if (rawResponse && typeof rawResponse === 'object') {
        const candidate = rawResponse as Record<string, unknown>
        if (typeof candidate.code === 'string') {
          code = candidate.code as ErrorCode
        }
        if (candidate.args && typeof candidate.args === 'object') {
          args = candidate.args as Record<string, unknown>
        }

        // 淇濈暀 class-validator 鐨勯獙璇侀敊璇鎯?
        if (Array.isArray(candidate.message) && candidate.message.length > 0) {
          args = {
            ...(args ?? {}),
            validationErrors: candidate.message,
          }
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message
    }

    const body: {
      status: number
      error: {
        code: ErrorCode
        args?: ErrorArgs
        requestId?: string
      }
      message?: unknown
      timestamp: string
      path: string
      debug?: Record<string, unknown>
    } = {
      status,
      error: {
        code: code ?? this.mapStatusToCode(status),
        args,
        requestId,
      },
      timestamp,
      path: request.originalUrl || request.url,
    }

    // 浠呭湪闈炵敓浜х幆澧冭繑鍥?message锛堥伒寰?鍚庣浠呰繑鍥?code + args"鐨勬灦鏋勮鑼冿級
    // 鐢熶骇鐜渚濊禆鍓嶇鏍规嵁 error.code 鍜?error.args 杩涜 i18n
    if (!this.env.isProd()) {
      body.message = message
    }

    if (rawResponse && typeof rawResponse === 'object' && (this.env.isE2E() || this.env.isTest() || !this.env.isProd())) {
      body.debug = {
        ...(body.debug ?? {}),
        rawResponse,
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    } else if (!(exception instanceof DomainException)) {
      this.logger.warn(`Handled exception on ${request.method} ${request.url}: ${message}`)
    }

    response.status(status).json(body)
  }

  private handlePrismaException(exception: PrismaClientKnownRequestError, req: Request, res: Response): void {
    const code = exception.code
    const requestId = this.ensureRequestId(req, res)
    const timestamp = new Date().toISOString()
    const path = req.originalUrl || req.url
    const method = req.method

    const logMeta = {
      method,
      path,
      requestId,
      prismaCode: code,
      meta: exception.meta,
    }

    if (code === 'P2034') {
      this.logger.error(`馃毃 Prisma transaction timeout`, logMeta)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          args: { detail: 'TransactionTimeout' },
          requestId,
        },
        timestamp,
        path,
      })
      return
    }

    if (code === 'P2002') {
      this.logger.warn(`Prisma unique constraint violation`, logMeta)
      res.status(HttpStatus.CONFLICT).json({
        status: HttpStatus.CONFLICT,
        error: {
          code: ErrorCode.CONFLICT,
          args: {
            detail: 'UniqueConstraintViolation',
            target: this.readMetaArray(exception.meta, 'target'),
          },
          requestId,
        },
        timestamp,
        path,
      })
      return
    }

    if (code === 'P2025') {
      this.logger.warn(`Prisma record not found`, logMeta)
      res.status(HttpStatus.NOT_FOUND).json({
        status: HttpStatus.NOT_FOUND,
        error: {
          code: ErrorCode.NOT_FOUND,
          args: { detail: 'RecordNotFound' },
          requestId,
        },
        timestamp,
        path,
      })
      return
    }

    this.logger.error(`Prisma error`, {
      ...logMeta,
      message: exception.message,
      stack: exception.stack,
    })

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        args: { detail: 'DatabaseError' },
        requestId,
      },
      timestamp,
      path,
    })
  }

  private extractHttpMessage(rawResponse: unknown, fallback: string): unknown {
    if (typeof rawResponse === 'string') {
      return rawResponse
    }
    if (rawResponse && typeof rawResponse === 'object') {
      const payload = rawResponse as Record<string, unknown>
      if (Array.isArray(payload.message)) {
        return payload.message
      }
      if (typeof payload.message === 'string') {
        return payload.message
      }
      if (typeof payload.error === 'string') {
        return payload.error
      }
    }
    return fallback
  }

  private ensureRequestId(req: Request, res: Response): string {
    const existing = res.getHeader('X-Request-Id') || req.headers['x-request-id']
    const candidate = Array.isArray(existing) ? existing[0] : existing
    const requestId =
      typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : randomUUID()

    // 濡傛灉鍝嶅簲澶村凡缁忓彂閫侊紙渚嬪 SSE 宸茬粡寮€濮嬫帹娴侊級锛屼笉瑕佸啀灏濊瘯璁剧疆鍝嶅簲澶达紝
    // 鍚﹀垯浼氳Е鍙?"Cannot set headers after they are sent to the client" 閿欒銆?
    if (!res.headersSent) {
      res.setHeader('X-Request-Id', requestId)
    }
    req.headers['x-request-id'] = requestId
    return requestId
  }

  private readMetaArray(meta: unknown, key: string): unknown[] {
    if (!meta || typeof meta !== 'object') {
      return []
    }
    const value = (meta as Record<string, unknown>)[key]
    return Array.isArray(value) ? value : []
  }

  private mapStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.UNPROCESSABLE_ENTITY
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR
    }
  }
}
