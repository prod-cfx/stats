/**
 * RULE_BLOCK_ATOM_EMITS — Issue #1313 PR3 兑现的 rule-level `emit.ruleBlockShape` 真实实现。
 *
 * 当前 1 atom：
 *   - `risk.partial_take_profit` ←→
 *     `canonical-spec-v2-ir-compiler.service.ts#tryCompileReduceActionRule` (L2964-L3023)
 *
 * 行为与原同名 service 私有方法严格等价（IR snapshot byte-equal），shape 通过
 * `ctx.helpers.*` 与 `ctx.compileContext.*Map` 完成 series / predicate /
 * runtimeRequirements 写入；dispatcher 在 `tryCompileReduceActionRule` 内反查
 * REGISTRY 调度。
 */

import type { RuleBlock } from '../types/canonical-strategy-ir'
import type { CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import type { RuleBlockShape } from './atom-contract-emit.types'
import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'

/**
 * 仅覆盖 `capabilityStatus` + `ruleBlockShape` 两个字段。`capability` 三元组、
 * `evidenceSource` 与 sentinel `irShape` 由 `createPr1bEmit` 继承（与 dispatcher
 * self-baseline snapshot 一致），保持 `_NonConditionIrShapeNotApplicable` 守门
 * 对其余字段的不变量。
 */
export type RuleBlockEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'ruleBlockShape'>

// `RuleLikeInput` / `SpecLikeInput` 在 emit.types.ts 仍是
// `Readonly<Record<string, unknown>>` 占位（PR2/PR4 兼容），shape 内显式 cast
// 到 canonical 真实类型再走逻辑。dispatcher 端实际传入的就是 CanonicalRuleV2 /
// CanonicalStrategySpecV2，cast 0 运行期开销。
//
// mirror service 私有 `tryCompileReduceActionRule` body
//   @ canonical-spec-v2-ir-compiler.service.ts:2964-3023
const partialTakeProfitRuleBlockShape: RuleBlockShape = (
  _atom,
  ruleInput,
  specInput,
  fallbackPositionPct,
  { compileContext: c, helpers },
) => {
  const rule = ruleInput as unknown as CanonicalRuleV2
  const spec = specInput as unknown as CanonicalStrategySpecV2

  const ptpMeta = rule.metadata?.partialTakeProfit
  if (
    !ptpMeta
    || rule.phase !== 'risk'
    || rule.condition.kind !== 'atom'
    || rule.condition.key !== 'risk.partial_take_profit'
  ) {
    return null
  }

  const reduceActions = rule.actions.filter(action =>
    action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT',
  )
  if (reduceActions.length === 0) {
    return null
  }

  const threshold = helpers.readNumber([rule.condition.value], Number.NaN)
  if (!Number.isFinite(threshold)) {
    return null
  }

  const pnlSeriesId = helpers.ensurePositionSeries(c, 'POSITION_PNL_PCT', 'position_pnl_pct')
  const constSeriesId = helpers.ensureConstSeries(c, threshold)
  const predicateRef = helpers.upsertPredicate(
    c.predicateMap,
    `${rule.id}_pnl_gte`,
    'GTE',
    [pnlSeriesId, constSeriesId],
  )

  const compiledActions = helpers.compileActions(
    { ...rule, actions: reduceActions },
    spec,
    fallbackPositionPct,
  )
  if (compiledActions.length === 0) {
    return null
  }

  c.runtimeRequirements.stateKeys.add(ptpMeta.memoryKey)

  // Partial take profit firing is gated by tier_*_fired flags in
  // semanticRuntimeState (see run-decision-programs.ts), so cooldownBars
  // would be redundant and could only mask a real bug. Intentionally drop it.
  const block: RuleBlock = {
    id: rule.id,
    phase: 'exit',
    when: predicateRef,
    priority: rule.priority,
    actions: compiledActions,
    metadata: { partialTakeProfit: { ...ptpMeta } },
  }
  return block
}

export const RULE_BLOCK_ATOM_EMITS = {
  'risk.partial_take_profit': {
    capabilityStatus: 'pr3e-rule-block',
    ruleBlockShape: partialTakeProfitRuleBlockShape,
  },
} satisfies Partial<Record<AtomContractKey, RuleBlockEmitOverride>>
