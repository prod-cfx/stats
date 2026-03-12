import { ErrorCode } from '@ai/shared/constants/error-codes'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidExecutionConfigException extends DomainException {
  constructor(params: { reason: string; details?: Record<string, unknown> }) {
    super('Invalid strategy execution config', {
      code: ErrorCode.STRATEGY_TEMPLATE_INVALID_EXECUTION,
      args: params,
    })
  }
}
