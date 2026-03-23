import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

export class DataSyncOperationTimeoutException extends DomainException {
  constructor(args: { operation: string; timeoutMs: number }) {
    super('data-sync.operation_timeout', {
      code: ErrorCode.DATA_SYNC_OPERATION_TIMEOUT,
      status: HttpStatus.GATEWAY_TIMEOUT,
      args,
    })
  }
}
