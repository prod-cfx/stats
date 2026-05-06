import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

// Phase 1 不主动抛此异常；预先建好供后续业务模块（codegen / V3 引擎迁移时）import
export class MastraGenerationFailedException extends DomainException {
  constructor(args: { agentId: string; reason: string }) {
    super(`Mastra generation failed for agent ${args.agentId}: ${args.reason}`, {
      code: ErrorCode.MASTRA_GENERATION_FAILED,
      args,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  }
}
