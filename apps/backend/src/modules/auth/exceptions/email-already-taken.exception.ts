import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class EmailAlreadyTakenException extends DomainException {
  constructor(params: { email: string }) {
    super('Email already registered', {
      code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN,
      status: HttpStatus.CONFLICT,
      args: params,
    })
  }
}


