import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyTemplateNameConflictException extends DomainException {
  constructor(params: { name: string }) {
    super('Strategy template name already exists', {
      code: ErrorCode.STRATEGY_TEMPLATE_NAME_CONFLICT,
      args: params,
      status: HttpStatus.CONFLICT,
    })
  }
}
