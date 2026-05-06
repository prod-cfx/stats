import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class MastraProviderMissingCredentialException extends DomainException {
  constructor(args: { providerCode: string; expectedEnv: string; modelId?: string }) {
    super(
      `Mastra provider "${args.providerCode}" credential missing: env "${args.expectedEnv}" is unset`,
      {
        code: ErrorCode.MASTRA_PROVIDER_MISSING_CREDENTIAL,
        args,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    )
  }
}
