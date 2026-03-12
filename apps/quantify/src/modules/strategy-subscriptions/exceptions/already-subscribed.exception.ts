import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AlreadySubscribedException extends DomainException {
  constructor(params: { strategyInstanceId: string }) {
    super('User already subscribed to this strategy instance', {
      code: ErrorCode.SUBSCRIPTION_ALREADY_EXISTS,
      args: params,
    })
  }
}
