import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class UserIdMismatchException extends DomainException {
  constructor(args?: { authUserId?: string; inputUserId?: string }) {
    super('account_strategy.user_id_mismatch', {
      code: ErrorCode.ACCOUNT_STRATEGY_USER_ID_MISMATCH,
      status: HttpStatus.FORBIDDEN,
      args: args as Record<string, unknown>,
    })
  }
}
