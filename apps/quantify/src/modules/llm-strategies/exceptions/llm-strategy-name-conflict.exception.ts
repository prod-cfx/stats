import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyNameConflictException extends DomainException {
  constructor(params: { name: string }) {
    super('LLM strategy name already exists', {
      code: ErrorCode.LLM_STRATEGY_NAME_CONFLICT,
      args: params,
      status: HttpStatus.CONFLICT,
    })
  }
}
