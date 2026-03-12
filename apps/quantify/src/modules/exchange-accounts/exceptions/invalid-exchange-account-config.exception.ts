import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidExchangeAccountConfigException extends DomainException {
  constructor(params: { exchangeId: string }) {
    super('Invalid exchange account configuration', {
      code: ErrorCode.EXCHANGE_ACCOUNT_INVALID_CONFIG,
      args: params,
    })
  }
}
