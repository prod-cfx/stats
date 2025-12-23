import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class VerificationCodeInvalidException extends DomainException {
  constructor(params: { email: string }) {
    super('Verification code is invalid', {
      code: ErrorCode.AUTH_VERIFICATION_CODE_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: params,
    })
  }
}


