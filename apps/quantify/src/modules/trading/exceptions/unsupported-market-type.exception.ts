import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class UnsupportedMarketTypeException extends DomainException {
  constructor(params: { exchangeId: string; marketType: string }) {
    super('Unsupported market type', {
      code: ErrorCode.TRADING_UNSUPPORTED_MARKET_TYPE,
      args: params,
    })
  }
}
