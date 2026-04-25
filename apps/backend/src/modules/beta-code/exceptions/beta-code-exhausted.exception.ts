import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class BetaCodeExhaustedException extends DomainException {
  constructor() {
    super('Beta code has no remaining uses', {
      code: ErrorCode.BETA_CODE_EXHAUSTED,
      status: HttpStatus.CONFLICT,
    })
  }
}
