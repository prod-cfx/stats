import type { ErrorCode } from '@ai/shared'
import { HttpException, HttpStatus } from '@nestjs/common'

export interface DomainExceptionOptions {
  code: ErrorCode
  args?: Record<string, unknown>
  status?: HttpStatus
}

/**
 * 棰嗗煙寮傚父鍩虹被
 * 鎵€鏈変笟鍔″紓甯稿繀椤荤户鎵挎绫?
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
