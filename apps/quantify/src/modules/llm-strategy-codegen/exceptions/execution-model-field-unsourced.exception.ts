import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export type ExecutionModelSourcedField = 'symbol' | 'venue' | 'primaryTimeframe' | 'instrumentType'
export type ExecutionModelFieldUnsourcedReason = 'missing' | 'inferred'

/**
 * Issue #1459 闸 4：ExecutionModel 字段来源 invariant 拒因。
 *
 * EXECUTION_MODEL 关键字段（symbol / venue / primaryTimeframe / instrumentType）
 * 必须能反查 `contextSlots.<field>`，且：
 *   - status === 'locked'
 *   - evidence.source === 'user_explicit'
 *
 * 当字段缺失或来源不合规时抛此异常。outer catch 通过 typed getter
 * （`field` / `reason` / `actualSource`）读取结构化字段，
 * 不依赖 `error.args` 的字符串约定，避免下游 refactor 静默漂移。
 */
export class ExecutionModelFieldUnsourcedException extends DomainException {
  constructor(args: {
    field: ExecutionModelSourcedField
    reason: ExecutionModelFieldUnsourcedReason
    actualSource?: string | null
  }) {
    const sourceHint = args.reason === 'inferred'
      ? `（source=${args.actualSource ?? 'unknown'}；要求 'user_explicit'）`
      : '（contextSlots 未锁定）'
    const reasonText = args.reason === 'inferred' ? '来源不合规' : '缺失'
    super(
      `策略字段 '${args.field}' ${reasonText}${sourceHint}`,
      {
        code: ErrorCode.EXECUTION_MODEL_FIELD_UNSOURCED,
        status: HttpStatus.BAD_REQUEST,
        args: {
          field: args.field,
          reason: args.reason,
          actualSource: args.actualSource ?? null,
        },
      },
    )
  }

  get field(): ExecutionModelSourcedField {
    return this.args?.field as ExecutionModelSourcedField
  }

  get reason(): ExecutionModelFieldUnsourcedReason {
    return this.args?.reason as ExecutionModelFieldUnsourcedReason
  }

  get actualSource(): string | null {
    const value = this.args?.actualSource
    return typeof value === 'string' ? value : null
  }
}
