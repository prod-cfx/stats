import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class MarketInvalidTimeframeException extends DomainException {
  constructor(params: { timeframe: string }) {
    super('Unsupported timeframe', {
      code: ErrorCode.MARKET_INVALID_TIMEFRAME,
      args: params,
    })
  }
}
