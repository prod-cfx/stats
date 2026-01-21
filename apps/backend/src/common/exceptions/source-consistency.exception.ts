import { ErrorCode } from '@ai/shared'
import { DomainException } from './domain.exception'

export class SourceConsistencyException extends DomainException {
  constructor(data: { expected: string; got: string }) {
    super('Source consistency check failed', {
      code: ErrorCode.DATA_CONSISTENCY_ERROR,
      args: data,
    })
  }
}
