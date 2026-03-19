import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid email or password', {
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    })
  }
}


