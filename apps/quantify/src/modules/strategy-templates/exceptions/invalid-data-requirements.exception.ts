import { ErrorCode } from '@ai/shared/constants/error-codes'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidDataRequirementsException extends DomainException {
  constructor(params: { reason: string; details?: Record<string, unknown> }) {
    super('Invalid strategy data requirements', {
      code: ErrorCode.STRATEGY_TEMPLATE_INVALID_DATA_REQUIREMENTS,
      args: params,
    })
  }
}
