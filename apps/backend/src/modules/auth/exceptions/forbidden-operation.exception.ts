import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class ForbiddenOperationException extends DomainException {
  constructor(params: { resource: string; reason?: string }) {
    super('Forbidden operation', {
      code: ErrorCode.AUTH_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
      args: params,
    })
  }
}
