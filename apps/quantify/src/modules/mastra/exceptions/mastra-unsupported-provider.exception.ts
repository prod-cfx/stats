import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

// Phase 1 仅实现 'default' provider；其他 providerCode 进入此死分支
// Phase 2/3 扩展 strategy-codegen 等 provider 时只需在 MastraService 加分支并移除此校验
export class MastraUnsupportedProviderException extends DomainException {
  constructor(args: { providerCode: string }) {
    super(
      `Mastra provider "${args.providerCode}" not supported in current phase`,
      {
        code: ErrorCode.MASTRA_UNSUPPORTED_PROVIDER,
        args,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    )
  }
}
