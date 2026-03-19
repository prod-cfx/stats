import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class LedgerEntryConflictException extends DomainException {
  constructor(params: { referenceId: string }) {
    super('Duplicate ledger entry reference', {
      code: ErrorCode.PORTFOLIO_LEDGER_CONFLICT,
      args: params,
    })
  }
}
