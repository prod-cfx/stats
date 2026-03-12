import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class PositionNotFoundException extends DomainException {
  constructor(params: { accountId: string; symbol: string; positionSide: string }) {
    super('Position not found', {
      code: ErrorCode.PORTFOLIO_POSITION_NOT_FOUND,
      args: params,
    })
  }
}
