import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class UnsupportedExchangeException extends DomainException {
  constructor(params: { exchangeId: string }) {
    super('Unsupported exchange', {
      code: ErrorCode.TRADING_UNSUPPORTED_EXCHANGE,
      args: params,
    })
  }
}
