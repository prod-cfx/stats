import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class StrategyPlazaOfficialSnapshotUnavailableException extends DomainException {
  constructor(args: { templateId: string, officialSnapshotId: string }) {
    super('strategy_plaza.official_snapshot_unavailable', {
      code: ErrorCode.STRATEGY_PLAZA_OFFICIAL_SNAPSHOT_UNAVAILABLE,
      status: HttpStatus.NOT_FOUND,
      args: {
        ...args,
        reasonMessage: '官方策略快照暂不可用，请稍后重试',
      },
    })
  }
}
