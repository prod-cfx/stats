import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidStrategyActionException extends DomainException {
  constructor(args?: { action?: string }) {
    super('account_strategy.invalid_action', {
      code: ErrorCode.ACCOUNT_STRATEGY_INVALID_ACTION,
      status: HttpStatus.BAD_REQUEST,
      args: args as Record<string, unknown>,
    })
  }
}
