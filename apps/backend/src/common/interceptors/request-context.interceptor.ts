import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ClsService } from 'nestjs-cls'
import type { Observable } from 'rxjs'
import type { AuthenticatedUser } from '../types/authenticated-user.type'
import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { ClsService as ClsServiceToken } from 'nestjs-cls'

const REQUEST_CONTEXT_KEY = 'REQUEST_CONTEXT'
const REQUEST_ID_KEY = 'REQUEST_ID'

interface RequestContextPayload {
  requestId: string
  path: string
  method: string
  userId?: string
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(@Inject(ClsServiceToken) private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    if (!request || !response) {
      return next.handle()
    }

    const requestId = this.ensureRequestId(request, response)
    const payload: RequestContextPayload = {
      requestId,
      method: request.method,
      path: request.originalUrl || request.url,
      userId: this.resolveUserId(request.user),
    }

    return this.cls.run(() => {
      this.cls.set(REQUEST_CONTEXT_KEY, payload)
      this.cls.set(REQUEST_ID_KEY, requestId)
      return next.handle()
    })
  }

  private ensureRequestId(request: Request, response: Response): string {
    const existing = request.headers['x-request-id']
    const candidate = Array.isArray(existing) ? existing[0] : existing
    const requestId = typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : randomUUID()

    request.headers['x-request-id'] = requestId
    // 对于已经开始写出响应的场景（例如 SSE），避免再次设置响应头。
    if (!response.headersSent) {
      response.setHeader('X-Request-Id', requestId)
    }
    return requestId
  }

  private resolveUserId(user: unknown): string | undefined {
    if (!user || typeof user !== 'object') {
      return undefined
    }
    const candidate = user as AuthenticatedUser
    return typeof candidate.id === 'string' ? candidate.id : undefined
  }
}


