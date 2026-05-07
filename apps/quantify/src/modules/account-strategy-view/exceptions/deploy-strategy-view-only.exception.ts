import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class DeployStrategyViewOnlyException extends DomainException {
  constructor(args?: { strategyInstanceId?: string }) {
    super('account_strategy.deploy_strategy_view_only', {
      code: ErrorCode.STRATEGY_INSTANCE_VIEW_ONLY,
      status: HttpStatus.BAD_REQUEST,
      args: args as Record<string, unknown>,
    })
  }
}
