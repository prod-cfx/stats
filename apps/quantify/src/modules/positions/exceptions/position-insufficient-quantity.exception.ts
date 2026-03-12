import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class PositionInsufficientQuantityException extends DomainException {
  constructor(params: { positionId: string; available: string; requested: string }) {
    super('Close quantity exceeds position quantity', {
      code: ErrorCode.PORTFOLIO_POSITION_INSUFFICIENT_QUANTITY,
      args: params,
    })
  }
}
