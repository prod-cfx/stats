import type { ErrorCode } from '@ai/shared'
import { HttpException, HttpStatus } from '@nestjs/common'

export interface DomainExceptionOptions {
  code: ErrorCode
  args?: Record<string, unknown>
  status?: HttpStatus
}

/**
 * 领域异常基类
 * 所有业务异常必须继承此类
 */
export class DomainException extends HttpException {
  public readonly code: ErrorCode
  public readonly args?: Record<string, unknown>

  constructor(message: string, options: DomainExceptionOptions) {
    const status = options.status || HttpStatus.BAD_REQUEST
    super(
      {
        code: options.code,
        message,
        args: options.args,
      },
      status,
    )
    this.code = options.code
    this.args = options.args
  }
}

