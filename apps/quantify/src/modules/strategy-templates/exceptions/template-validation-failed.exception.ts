import { ErrorCode } from '@ai/shared/constants/error-codes'

import { DomainException } from '@/common/exceptions/domain.exception'

export class TemplateValidationFailedException extends DomainException {
  constructor(params: { reason: string; warnings: string[]; details?: Record<string, unknown> }) {
    super('Template validation failed', {
      code: ErrorCode.STRATEGY_TEMPLATE_VALIDATION_FAILED,
      args: params,
    })
  }
}
