import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class DeployModeAccountMismatchException extends DomainException {
  constructor(args?: { expectedMode?: string; accountIsTestnet?: boolean; exchangeAccountId?: string }) {
    super('account_strategy.deploy_mode_account_mismatch', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: args as Record<string, unknown>,
    })
  }
}
