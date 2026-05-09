import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class InternalKeyLeakDetectedException extends DomainException {
  constructor(params: { key: string; details?: string }) {
    // 保持 message 与历史 raw Error 一致（'semantic_presentation_internal_key_leak:<key>'），
    // 让现有 string-match 测试与 caller 行为不破。结构化字段走 args / code。
    super(`semantic_presentation_internal_key_leak:${params.key}`, {
      code: ErrorCode.INTERNAL_KEY_LEAK_DETECTED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: params,
    })
  }
}
