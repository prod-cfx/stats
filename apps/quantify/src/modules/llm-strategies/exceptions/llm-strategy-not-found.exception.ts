import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyNotFoundException extends DomainException {
  constructor(params: { strategyId: string }) {
    super('LLM strategy not found', {
      code: ErrorCode.LLM_STRATEGY_NOT_FOUND,
      args: params,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
