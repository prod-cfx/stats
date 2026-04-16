import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class DeploySnapshotRequiresRepublishException extends DomainException {
  constructor(args?: { publishedSnapshotId?: string }) {
    super('account_strategy.deploy_snapshot_requires_republish', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: args as Record<string, unknown>,
    })
  }
}
