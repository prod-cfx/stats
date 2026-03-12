import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyNotAvailableException extends DomainException {
  constructor(params: { strategyInstanceId: string; status: string; message?: string }) {
    super(params.message || 'Strategy instance not available for subscription', {
      code: ErrorCode.STRATEGY_NOT_AVAILABLE,
      args: { strategyInstanceId: params.strategyInstanceId, status: params.status },
    })
  }
}
