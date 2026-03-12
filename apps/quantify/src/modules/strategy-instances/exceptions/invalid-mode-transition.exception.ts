import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidInstanceModeTransitionException extends DomainException {
  constructor(context: { from: string; to: string; reason: string }) {
    super(
      `鏃犳硶浠?${context.from} 妯″紡鍒囨崲鍒?${context.to} 妯″紡: ${context.reason}`,
      {
        code: ErrorCode.STRATEGY_INSTANCE_INVALID_MODE_TRANSITION,
        args: context,
        status: HttpStatus.BAD_REQUEST,
      }
    )
  }
}
