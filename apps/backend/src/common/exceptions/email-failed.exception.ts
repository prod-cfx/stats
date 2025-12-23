import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from './domain.exception'

type EmailFailedExceptionArgs = Record<string, unknown> & {
  recipient?: string
  reason?: string
}

export class EmailFailedException extends DomainException {
  constructor(args?: EmailFailedExceptionArgs) {
    super('Failed to send email', {
      code: ErrorCode.EMAIL_SEND_FAILED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args,
    })
  }
}


