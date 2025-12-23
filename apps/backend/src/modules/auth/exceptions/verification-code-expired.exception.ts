import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class VerificationCodeExpiredException extends DomainException {
  constructor(params: { email: string }) {
    super('Verification code has expired', {
      code: ErrorCode.AUTH_VERIFICATION_CODE_EXPIRED,
      status: HttpStatus.BAD_REQUEST,
      args: params,
    })
  }
}


