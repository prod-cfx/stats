import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AiProviderNotFoundException extends DomainException {
  constructor(params: { providerCode: string }) {
    super('AI provider not found', {
      code: ErrorCode.AI_PROVIDER_NOT_FOUND,
      args: params,
    })
  }
}
