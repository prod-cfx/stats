import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOkxDemoApiKeyRequiredException extends DomainException {
  constructor(args: { userId: string }) {
    super('strategy_plaza.okx_demo_api_key_required', {
      code: ErrorCode.STRATEGY_PLAZA_OKX_DEMO_API_KEY_REQUIRED,
      status: HttpStatus.BAD_REQUEST,
      args: {
        ...args,
        reasonMessage: '请先绑定 OKX 模拟盘 API Key',
      },
    })
  }
}
