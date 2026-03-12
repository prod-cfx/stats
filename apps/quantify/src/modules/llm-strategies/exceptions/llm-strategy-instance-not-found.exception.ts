import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyInstanceNotFoundException extends DomainException {
  constructor(params: { instanceId: string }) {
    super('LLM strategy instance not found', {
      code: ErrorCode.LLM_STRATEGY_INSTANCE_NOT_FOUND,
      args: params,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
