import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyInstanceNameConflictException extends DomainException {
  constructor(params: { name: string; strategyId: string }) {
    super('LLM strategy instance name already exists in this strategy', {
      code: ErrorCode.LLM_STRATEGY_INSTANCE_NAME_CONFLICT,
      args: params,
      status: HttpStatus.CONFLICT,
    })
  }
}
