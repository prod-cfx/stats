import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class SubscriptionNotFoundException extends DomainException {
  constructor(params: { subscriptionId: string }) {
    super('Subscription not found', {
      code: ErrorCode.SUBSCRIPTION_NOT_FOUND,
      args: params,
    })
  }
}
