import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class SizingEvidenceMissingException extends DomainException {
  constructor(params: { ruleId: string; actionType: string }) {
    super(
      `Compile-time sizing evidence missing: actionable rule action has no sizing resolved`,
      {
        code: ErrorCode.SIZING_EVIDENCE_MISSING,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        args: params,
      },
    )
  }
}
