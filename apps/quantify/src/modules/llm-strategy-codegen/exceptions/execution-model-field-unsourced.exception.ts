import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Issue #1459 闸 4：ExecutionModel 字段来源 invariant 拒因。
 *
 * EXECUTION_MODEL 关键字段（symbol / venue / primaryTimeframe / instrumentType）
 * 必须能反查 `contextSlots.<field>`，且：
 *   - status === 'locked'
 *   - evidence.source === 'user_explicit'
 *
 * 当字段缺失（contextSlots[field] = null / status !== 'locked'）或来源不合规
 * （source === 'inferred' / 'derived'）时抛此异常。
 *
 * 抛出点：codegen-publication-generation.stage.ts 的 buildSemanticPublishParams /
 *   buildCompiledIrFallback —— IR build 入口在 fallback 默认值绕过之前 fail-closed。
 *
 * Pipeline outer catch（codegen-session-publication-pipeline.service.ts）识别后
 * 把结构化 payload 落到 session.specDesc.publicationGate.blocked=true，前端可与
 * #1456 闸 1 / #1457 闸 2 的拦截一致地展示「字段来源不合规」。
 */
export class ExecutionModelFieldUnsourcedException extends DomainException {
  constructor(args: {
    field: 'symbol' | 'venue' | 'primaryTimeframe' | 'instrumentType'
    /** 'missing' = contextSlots[field] 为 null / 未 locked；'inferred' = 来源不合规 */
    reason: 'missing' | 'inferred'
    actualSource?: string | null
  }) {
    const sourceHint = args.reason === 'inferred'
      ? ` (source=${args.actualSource ?? 'unknown'}; require 'user_explicit')`
      : ' (contextSlots not locked)'
    super(
      `codegen.execution_model_field_unsourced: field '${args.field}' ${args.reason}${sourceHint}`,
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
}
