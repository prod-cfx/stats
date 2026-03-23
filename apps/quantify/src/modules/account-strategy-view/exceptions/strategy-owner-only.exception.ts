import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyOwnerOnlyException extends DomainException {
  constructor(args?: { userId?: string; ownerId?: string }) {
    super('account_strategy.owner_only', {
      code: ErrorCode.ACCOUNT_STRATEGY_OWNER_ONLY,
      status: HttpStatus.FORBIDDEN,
      args: args as Record<string, unknown>,
    })
  }
}
