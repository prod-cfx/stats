import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOfficialSnapshotUnavailableException extends DomainException {
  constructor(args: { templateId: string, officialSnapshotId: string }) {
    super('strategy_plaza.official_snapshot_unavailable', {
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args,
    })
  }
}
