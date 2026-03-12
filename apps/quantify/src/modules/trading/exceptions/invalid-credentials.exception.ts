import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidCredentialsException extends DomainException {
  constructor(params: { exchangeId: string; message?: string }) {
    super(params.message || 'Invalid exchange credentials', {
      code: ErrorCode.TRADING_INVALID_CREDENTIALS,
      args: params,
    })
  }
}
