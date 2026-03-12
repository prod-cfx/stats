import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class ExchangeInitFailedException extends DomainException {
  constructor(params: { exchangeId: string; reason: string }) {
    super('Exchange initialization failed', {
      code: ErrorCode.TRADING_EXCHANGE_INIT_FAILED,
      args: params,
    })
  }
}
