import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export class InvalidSettingTypeException extends DomainException {
  constructor(params: { key: string; expectedType: string; actualType: string }) {
    super('Setting type mismatch', {
      code: ErrorCode.SETTINGS_TYPE_MISMATCH,
      args: params,
    })
  }
}

export class JsonExpectedObjectOrArrayException extends DomainException {
  constructor(params: { key: string; actualType: string }) {
    super('Setting expected JSON object or array', {
      code: ErrorCode.SETTINGS_JSON_EXPECTED_OBJECT_OR_ARRAY,
      args: params,
    })
  }
}
