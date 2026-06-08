import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOkxLiveApiKeyRequiredException extends DomainException {
  constructor(args: { userId: string }) {
    super('strategy_plaza.okx_live_api_key_required', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        ...args,
        reasonMessage: '请先绑定 OKX 主网 API Key',
      },
    })
  }
}
