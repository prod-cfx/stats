import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AtomVersionGateValidationFailedException extends DomainException {
  constructor(params: { version: string; reason?: string }) {
    super('Atom version gate validation failed: invalid semantic version format', {
      code: ErrorCode.ATOM_VERSION_GATE_VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
      args: params,
    })
  }
}
