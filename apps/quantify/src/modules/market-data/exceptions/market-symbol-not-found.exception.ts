import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class MarketSymbolNotFoundException extends DomainException {
  constructor(params: { symbol: string }) {
    super('Market symbol not found', {
      code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
      args: params,
    })
  }
}
