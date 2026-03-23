import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class MissingUserIdentityException extends DomainException {
  constructor() {
    super('account_strategy.missing_identity', {
      code: ErrorCode.ACCOUNT_STRATEGY_MISSING_IDENTITY,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
