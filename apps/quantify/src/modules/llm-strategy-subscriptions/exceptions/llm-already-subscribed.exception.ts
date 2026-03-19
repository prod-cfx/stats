import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmAlreadySubscribedException extends DomainException {
  constructor(params: { llmStrategyInstanceId: string }) {
    super('User already subscribed to this LLM strategy instance', {
      code: ErrorCode.SUBSCRIPTION_ALREADY_EXISTS,
      args: params,
    })
  }
}
