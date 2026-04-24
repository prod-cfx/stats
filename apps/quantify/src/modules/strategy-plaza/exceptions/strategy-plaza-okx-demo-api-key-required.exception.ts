import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOkxDemoApiKeyRequiredException extends DomainException {
  constructor(args: { userId: string }) {
    super('strategy_plaza.okx_demo_api_key_required', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}
