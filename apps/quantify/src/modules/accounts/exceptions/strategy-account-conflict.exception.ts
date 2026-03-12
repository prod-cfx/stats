import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyAccountConflictException extends DomainException {
  constructor(params: { userId: string; strategyId: string }) {
    super('User strategy account already exists', {
      code: ErrorCode.PORTFOLIO_ACCOUNT_CONFLICT,
      args: params,
    })
  }
}
