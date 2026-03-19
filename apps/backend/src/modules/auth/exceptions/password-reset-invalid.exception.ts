import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class PasswordResetInvalidException extends DomainException {
  constructor(params: { email: string }) {
    super('Password reset request is invalid', {
      code: ErrorCode.AUTH_PASSWORD_RESET_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: params,
    })
  }
}


