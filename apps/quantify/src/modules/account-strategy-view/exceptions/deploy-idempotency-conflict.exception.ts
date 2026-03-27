import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class DeployIdempotencyConflictException extends DomainException {
  constructor(args?: { deployRequestId?: string; status?: string }) {
    super('account_strategy.deploy_idempotency_conflict', {
      code: ErrorCode.CONFLICT,
      status: HttpStatus.CONFLICT,
      args: args as Record<string, unknown>,
    })
  }
}
