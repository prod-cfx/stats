import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { QuantifyClientError } from './clients/quantify-ai-quant.client'

@Injectable()
export class AiQuantProxySupportService {
  private static readonly TRANSIENT_UPSTREAM_CODES = new Set([
    'UPSTREAM_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
  ])

  private readonly logger = new Logger(AiQuantProxySupportService.name)

  userHeaders(userId: string, authorization: string | undefined) {
    return {
      'x-user-id': userId,
      ...(authorization ? { authorization } : {}),
    }
  }

  authorizationHeaders(authorization: string | undefined) {
    return authorization ? { authorization } : {}
  }

  proxyHeaders(authorization: string | undefined, requestId?: string) {
    return {
      ...(authorization ? { authorization } : {}),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    }
  }

  userProxyHeaders(userId: string, authorization: string | undefined, requestId?: string) {
    return {
      ...this.userHeaders(userId, authorization),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    }
  }

  mapQuantifyError(error: unknown): DomainException {
    if (this.isTransientUpstreamFailure(error)) {
      return this.buildTransientUnavailableException(error)
    }

    if (error instanceof QuantifyClientError) {
      return this.toDomainException(error.status, error.code, error.args, error.message)
    }

    if (this.isQuantifyErrorShape(error)) {
      return this.toDomainException(error.status, error.code, error.args, error.message)
    }

    if (error instanceof DomainException) {
      return error
    }

    return new DomainException('Quantify request failed', {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  }

  mapBacktestingJobError(error: unknown, requestId?: string): DomainException {
    if (this.isTransientUpstreamFailure(error)) {
      this.logger.warn(
        `event=backtesting_job_retryable_error reason=${this.describeError(error)} requestId=${requestId ?? 'N/A'}`,
      )
      return new DomainException('Backtesting upstream temporarily unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      })
    }
    return this.mapQuantifyError(error)
  }

  isTransientUpstreamFailure(error: unknown): boolean {
    const code = this.getQuantifyErrorCode(error)
    return typeof code === 'string' && AiQuantProxySupportService.TRANSIENT_UPSTREAM_CODES.has(code)
  }

  describeError(error: unknown): string {
    if (error instanceof QuantifyClientError) {
      return `${error.status}:${error.code ?? 'UNKNOWN'}:${error.message}`
    }
    if (this.isQuantifyErrorShape(error)) {
      return `${error.status}:${error.code ?? 'UNKNOWN'}:${error.message}`
    }
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }

  private buildTransientUnavailableException(error: unknown): DomainException {
    return new DomainException('Quantify service temporarily unavailable', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: {
        retryable: true,
        upstreamCode: this.getQuantifyErrorCode(error),
      },
    })
  }

  private toDomainException(
    status: number,
    code: string | undefined,
    args: Record<string, unknown> | undefined,
    fallbackMessage: string,
  ): DomainException {
    return new DomainException(
      typeof args?.reasonMessage === 'string' ? args.reasonMessage : fallbackMessage,
      {
        code: (code as ErrorCode | undefined) ?? ErrorCode.BAD_REQUEST,
        args,
        status,
      },
    )
  }

  private isQuantifyErrorShape(error: unknown): error is {
    status: number
    code?: string
    args?: Record<string, unknown>
    message: string
  } {
    return typeof error === 'object'
      && error !== null
      && 'status' in error
      && typeof (error as { status?: unknown }).status === 'number'
      && 'message' in error
      && typeof (error as { message?: unknown }).message === 'string'
  }

  private getQuantifyErrorCode(error: unknown): string | undefined {
    if (error instanceof QuantifyClientError) return error.code
    if (this.isQuantifyErrorShape(error)) return error.code
    return undefined
  }
}
