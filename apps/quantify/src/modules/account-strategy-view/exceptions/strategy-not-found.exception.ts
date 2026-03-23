import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyNotFoundException extends DomainException {
  constructor(args?: { strategyInstanceId?: string }) {
    super('account_strategy.not_found', {
      code: ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args: args as Record<string, unknown>,
    })
  }
}
