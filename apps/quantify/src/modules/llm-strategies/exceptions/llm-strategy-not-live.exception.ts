import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyNotLiveException extends DomainException {
  constructor(params: { strategyId: string; status: string }) {
    super('LLM strategy must be live before creating instances', {
      code: ErrorCode.LLM_STRATEGY_NOT_LIVE,
      args: params,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
