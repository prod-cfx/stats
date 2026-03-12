import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export interface InvalidSubscriptionParamsArgs {
  reason: 'MISSING_REQUIRED_FIELDS' | 'INVALID_TYPE' | 'JSON_SCHEMA_VALIDATION' | 'SCHEMA_TOO_LARGE' | 'VALIDATION_TIMEOUT'
  requiredFields?: string[]
  missingFields?: string[]
  schemaErrors?: unknown
}

export class InvalidSubscriptionParamsException extends DomainException {
  constructor(params: InvalidSubscriptionParamsArgs) {
    super('Invalid subscription params', {
      code: ErrorCode.SUBSCRIPTION_INVALID_PARAMS,
      args: params as unknown as Record<string, unknown>,
    })
  }
}
