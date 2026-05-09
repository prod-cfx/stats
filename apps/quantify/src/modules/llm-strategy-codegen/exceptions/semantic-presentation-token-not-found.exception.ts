import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class SemanticPresentationTokenNotFoundException extends DomainException {
  constructor(params: { token: string }) {
    super('Semantic presentation token not found in registry', {
      code: ErrorCode.SEMANTIC_PRESENTATION_TOKEN_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args: params,
    })
  }
}
