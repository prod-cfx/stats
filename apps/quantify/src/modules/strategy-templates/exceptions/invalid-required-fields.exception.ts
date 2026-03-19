import { ErrorCode } from '@ai/shared/constants/error-codes'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidRequiredFieldsException extends DomainException {
  constructor(params: { reason: string; details?: Record<string, unknown> }) {
    super('Invalid required fields', {
      code: ErrorCode.STRATEGY_TEMPLATE_INVALID_FIELDS,
      args: params,
    })
  }
}
