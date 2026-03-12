import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class ExchangeAccountNotFoundException extends DomainException {
  constructor(params: { accountId: string }) {
    super('Exchange account not found', {
      code: ErrorCode.EXCHANGE_ACCOUNT_NOT_FOUND,
      args: params,
    })
  }
}
