import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InsufficientBalanceException extends DomainException {
  constructor(params: { accountId: string; required: string; available: string }) {
    super('Insufficient account balance', {
      code: ErrorCode.PORTFOLIO_INSUFFICIENT_BALANCE,
      args: params,
    })
  }
}
