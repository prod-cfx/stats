import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class OrderCreationFailedException extends DomainException {
  constructor(params: { exchangeId: string; reason: string }) {
    super('Failed to create order', {
      code: ErrorCode.TRADING_ORDER_CREATION_FAILED,
      args: params,
    })
  }
}
