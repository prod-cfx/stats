import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmStrategyNotAvailableException extends DomainException {
  constructor(params: { llmStrategyInstanceId: string; status: string; message?: string }) {
    super(params.message ?? 'LLM strategy instance not available', {
      code: ErrorCode.STRATEGY_NOT_AVAILABLE,
      args: { llmStrategyInstanceId: params.llmStrategyInstanceId, status: params.status },
    })
  }
}
