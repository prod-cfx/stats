import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyAccountNotFoundException extends DomainException {
  constructor(params: { accountId: string }) {
    super('User strategy account not found', {
      code: ErrorCode.PORTFOLIO_ACCOUNT_NOT_FOUND,
      args: params,
    })
  }
}
