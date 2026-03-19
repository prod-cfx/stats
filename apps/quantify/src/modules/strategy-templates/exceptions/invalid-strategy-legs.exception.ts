import { ErrorCode } from '@ai/shared/constants/error-codes'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidStrategyLegsException extends DomainException {
  constructor(params: { reason: string; details?: Record<string, unknown> }) {
    super('Invalid strategy legs', {
      code: ErrorCode.STRATEGY_TEMPLATE_INVALID_LEGS,
      args: params,
    })
  }
}
