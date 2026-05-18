import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Issue #1457 闸 2 (review round 1 C2)：entry rule 编译期 invariant 拒因。
 *
 * 当编译完一条 phase='entry' 的 rule 后，遍历其 predicateRef 指向的 PredicateDef
 * 树（leaf / composite 由 PREDICATE_KIND_TEMPORALITY 分类）：
 *   - 所有 leaf 全部为 'state'（如 allOf[GTE × 3]）→ 抛此异常
 *   - 至少含一个 'event' leaf → 放行
 *
 * 抛出场景下，配合 signalEvaluation='bar_close' + fillPolicy='next_bar_open'，
 * 该 rule 会演变为每根 K 线持续 OPEN_LONG 加仓循环；强制要求至少含一个 event
 * 谓词（cross_over / cross_under / touch_* / breakout_* / sequence）。
 *
 * 抛出点：
 *   - canonical-strategy-ir-compiler.service.ts（legacy graph IR 路径）
 *   - canonical-spec-v2-ir-compiler.service.ts（生产 canonical spec V2 路径）
 *
 * Pipeline outer catch（codegen-session-publication-pipeline.service.ts）识别
 * 后落到 session.specDesc.publicationGate，并把 sessionRecord 推进 REJECTED
 * 状态，前端可与「未澄清被卡」一并展示。
 */
export class EntryRuleRequiresEventLeafException extends DomainException {
  constructor(args: { ruleId?: string; leafKinds: readonly string[] }) {
    const leafs = [...new Set(args.leafKinds)].join(', ')
    const ruleSuffix = args.ruleId ? ` (rule '${args.ruleId}')` : ''
    super(
      `codegen.entry_rule_requires_event_leaf${ruleSuffix}: composed entirely of state predicates (${leafs}); require at least one event leaf (cross_over/cross_under/touch_*/breakout_*/sequence)`,
      {
        code: ErrorCode.ENTRY_RULE_REQUIRES_EVENT_LEAF,
        status: HttpStatus.BAD_REQUEST,
        args: {
          ruleId: args.ruleId ?? null,
          leafKinds: [...args.leafKinds],
        },
      },
    )
  }
}
