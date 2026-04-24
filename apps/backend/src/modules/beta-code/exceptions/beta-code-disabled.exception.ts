import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class BetaCodeDisabledException extends DomainException {
  constructor() {
    super('Beta code is disabled', {
      code: ErrorCode.BETA_CODE_DISABLED,
      status: HttpStatus.FORBIDDEN,
    })
  }
}
