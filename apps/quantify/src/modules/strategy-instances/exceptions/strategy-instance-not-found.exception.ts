import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyInstanceNotFoundException extends DomainException {
  constructor(params: { instanceId: string }) {
    super('Strategy instance not found', {
      code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
      args: params,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
