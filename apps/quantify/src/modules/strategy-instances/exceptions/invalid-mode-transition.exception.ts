import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidInstanceModeTransitionException extends DomainException {
  constructor(context: { from: string; to: string; reason: string }) {
    super(
      `无法从 ${context.from} 模式切换到 ${context.to} 模式: ${context.reason}`,
      {
        code: ErrorCode.STRATEGY_INSTANCE_INVALID_MODE_TRANSITION,
        args: context,
        status: HttpStatus.BAD_REQUEST,
      }
    )
  }
}
