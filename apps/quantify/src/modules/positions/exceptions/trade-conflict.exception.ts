import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class TradeConflictException extends DomainException {
  constructor(params: { referenceId: string }) {
    super('Duplicate trade record', {
      code: ErrorCode.PORTFOLIO_TRADE_CONFLICT,
      args: params,
    })
  }
}
