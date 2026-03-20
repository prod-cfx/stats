import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AiNoActiveKeyException extends DomainException {
  constructor(params: { providerCode: string }) {
    super('No active AI provider key', {
      code: ErrorCode.AI_NO_ACTIVE_KEY,
      args: params,
    })
  }
}
