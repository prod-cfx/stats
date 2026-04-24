import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class BetaCodeRequiredException extends DomainException {
  constructor() {
    super('Beta code is required for new users', {
      code: ErrorCode.BETA_CODE_REQUIRED,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
