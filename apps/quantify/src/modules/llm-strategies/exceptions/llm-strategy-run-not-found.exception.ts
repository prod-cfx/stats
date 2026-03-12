import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyRunNotFoundException extends DomainException {
  constructor(params: { runId: string }) {
    super('LLM strategy run not found', {
      code: ErrorCode.LLM_STRATEGY_RUN_NOT_FOUND,
      args: params,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
