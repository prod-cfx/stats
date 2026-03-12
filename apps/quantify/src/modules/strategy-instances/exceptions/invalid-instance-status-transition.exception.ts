import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidInstanceStatusTransitionException extends DomainException {
  constructor(params: { currentStatus: string; targetStatus: string }) {
    super('Invalid instance status transition', {
      code: ErrorCode.INVALID_INSTANCE_STATUS_TRANSITION,
      args: params,
    })
  }
}
