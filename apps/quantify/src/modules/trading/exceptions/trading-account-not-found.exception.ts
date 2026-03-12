import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class TradingAccountNotFoundException extends DomainException {
  constructor(params: { userId: string; exchangeId: string }) {
    super('Trading account not found', {
      code: ErrorCode.TRADING_ACCOUNT_NOT_FOUND,
      args: params,
    })
  }
}
