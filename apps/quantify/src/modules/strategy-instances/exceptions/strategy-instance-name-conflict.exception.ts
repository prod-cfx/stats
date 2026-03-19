import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyInstanceNameConflictException extends DomainException {
  constructor(params: { strategyTemplateId: string; llmModel: string; name: string }) {
    super('Strategy instance name conflict', {
      code: ErrorCode.STRATEGY_INSTANCE_NAME_CONFLICT,
      args: params,
      status: HttpStatus.CONFLICT,
    })
  }
}
