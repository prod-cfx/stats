import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaTemplateNotFoundException extends DomainException {
  constructor(args: { templateId: string }) {
    super('strategy_plaza.template_not_found', {
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args,
    })
  }
}
