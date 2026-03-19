import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyTemplateNotFoundException extends DomainException {
  constructor(params: { templateId: string }) {
    super('Strategy template not found', {
      code: ErrorCode.STRATEGY_TEMPLATE_NOT_FOUND,
      args: params,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
