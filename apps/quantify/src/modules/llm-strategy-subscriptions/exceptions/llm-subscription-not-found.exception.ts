import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class LlmSubscriptionNotFoundException extends DomainException {
  constructor(params: { subscriptionId: string }) {
    super('LLM subscription not found', {
      code: ErrorCode.SUBSCRIPTION_NOT_FOUND,
      args: params,
    })
  }
}
