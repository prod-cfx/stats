import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class BetaCodeInvalidException extends DomainException {
  constructor() {
    super('Beta code is invalid', {
      code: ErrorCode.BETA_CODE_INVALID,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
