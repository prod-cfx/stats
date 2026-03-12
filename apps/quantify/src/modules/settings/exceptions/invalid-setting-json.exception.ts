import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidSettingJsonException extends DomainException {
  constructor(params: { key: string; error: string }) {
    super('Invalid JSON for setting', {
      code: ErrorCode.SETTINGS_INVALID_JSON,
      args: params,
    })
  }
}
