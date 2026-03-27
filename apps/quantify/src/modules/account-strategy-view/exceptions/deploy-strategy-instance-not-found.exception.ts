import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class DeployStrategyInstanceNotFoundException extends DomainException {
  constructor(args?: { strategyInstanceId?: string }) {
    super('account_strategy.deploy_strategy_instance_not_found', {
      code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args: args as Record<string, unknown>,
    })
  }
}
