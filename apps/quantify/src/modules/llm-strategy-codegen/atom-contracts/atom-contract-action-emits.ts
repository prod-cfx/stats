/**
 * ACTION_ATOM_EMITS — Issue #1313 PR5c 兑现的 6 个 action-level atom 的
 * `emit.actionShape` 真实实现。
 *
 * 与 `canonical-spec-v2-ir-compiler.service.ts#compileActions` (L3377-L3427)
 * 内 enum switch 上 OPEN/CLOSE/ADD case body 严格等价（IR snapshot byte-equal）。
 *
 * 6 atom ↔ action.type 映射：
 *   - `action.open_long`        ↔ OPEN_LONG  → resolveActionQuantity
 *   - `action.open_short`       ↔ OPEN_SHORT → resolveActionQuantity
 *   - `action.close_long`       ↔ CLOSE_LONG → { mode: 'position_pct', value: 100 }
 *   - `action.close_short`      ↔ CLOSE_SHORT → { mode: 'position_pct', value: 100 }
 *   - `action.add_position`     ↔ ADD_LONG | ADD_SHORT (按 action.type 分流) → resolveActionQuantity
 *   - `action.reverse_position` ↔ 双 action 共享 atomKey：CLOSE_* + OPEN_* (按 action.type 分流)
 *
 * dispatcher 端（`compileActions`）按 `action.atomKey` 反查 REGISTRY，命中
 * `capabilityStatus === 'pr3e-action'` + `emit.actionShape` 即调度；否则走 enum 兜底
 * （REDUCE_* / FORCE_EXIT / BLOCK_NEW_ENTRY 4 case 不在本 6 atom 集合内，由
 * 各自 rule-level / spec-level shape 承担）。
 */

import type { ActionDef } from '../types/canonical-strategy-ir'
import type {
  CanonicalRuleAction,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec-v2'
import type { ActionShape } from './atom-contract-emit.types'
import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'

/**
 * 仅覆盖 `capabilityStatus` + `actionShape` 两个字段。`capability` 三元组、
 * `evidenceSource` 与 sentinel `irShape` 由 `createPr1bEmit` 继承，与现有
 * dispatcher snapshot 形态保持一致（与 `RiskGuardEmitOverride` /
 * `RuleBlockEmitOverride` / `OrchestrationEmitOverride` 同形）。
 */
export type ActionEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'actionShape'>

// `ActionLikeInput` / `RuleLikeInput` / `SpecLikeInput` 在 emit.types.ts 仍是
// `Readonly<Record<string, unknown>>` 占位（PR5a 兼容），shape 内显式 cast 到
// canonical 真实类型再走逻辑。dispatcher 端实际传入的就是 CanonicalRuleAction /
// CanonicalRuleV2 / CanonicalStrategySpecV2，cast 0 运行期开销。
//
// 与 `compileActions` 内 case OPEN_*/ADD_* 等价的载体提取 + helper 调度。
function resolveOpenOrAddQuantity(
  actionInput: Readonly<Record<string, unknown>>,
  specInput: Readonly<Record<string, unknown>>,
  fallbackPositionPct: number,
  resolveActionQuantity: (
    a: CanonicalRuleAction,
    s: CanonicalStrategySpecV2['sizing'],
    f: number,
  ) => ActionDef['quantity'],
): ActionDef['quantity'] {
  const action = actionInput as unknown as CanonicalRuleAction
  const spec = specInput as unknown as CanonicalStrategySpecV2
  return resolveActionQuantity(action, spec.sizing, fallbackPositionPct)
}

const CLOSE_FULL_POSITION_QUANTITY: ActionDef['quantity'] = { mode: 'position_pct', value: 100 }

/** mirror `compileActions` case 'OPEN_LONG' body (L3386-L3394 enum 内单 case)。 */
const openLongActionShape: ActionShape = (_atom, action, _rule, spec, fallback, { helpers }) => [
  {
    kind: 'OPEN_LONG',
    quantity: resolveOpenOrAddQuantity(action, spec, fallback, helpers.resolveActionQuantity),
  },
]

/** mirror `compileActions` case 'OPEN_SHORT' body。 */
const openShortActionShape: ActionShape = (_atom, action, _rule, spec, fallback, { helpers }) => [
  {
    kind: 'OPEN_SHORT',
    quantity: resolveOpenOrAddQuantity(action, spec, fallback, helpers.resolveActionQuantity),
  },
]

/** mirror `compileActions` case 'CLOSE_LONG' body (L3396-L3402)。 */
const closeLongActionShape: ActionShape = () => [
  { kind: 'CLOSE_LONG', quantity: CLOSE_FULL_POSITION_QUANTITY },
]

/** mirror `compileActions` case 'CLOSE_SHORT' body。 */
const closeShortActionShape: ActionShape = () => [
  { kind: 'CLOSE_SHORT', quantity: CLOSE_FULL_POSITION_QUANTITY },
]

/**
 * mirror `compileActions` case 'ADD_LONG' / 'ADD_SHORT' body。
 *   单 atom (`action.add_position`) 透过 sideScope 派生为 ADD_LONG / ADD_SHORT
 *   两种 action.type，shape 按 action.type 分流。
 */
const addPositionActionShape: ActionShape = (_atom, actionInput, _rule, spec, fallback, { helpers }) => {
  const action = actionInput as unknown as CanonicalRuleAction
  if (action.type !== 'ADD_LONG' && action.type !== 'ADD_SHORT') {
    // PR6 fail-loud：dispatcher 反查 atomKey='action.add_position' 但 action.type 不是
    // ADD_* —— builder `buildActionsForSemanticLifecycleAction` 仅在 ADD_* 挂载本
    // atomKey，到达此分支说明 spec 漂移或 builder 透传被破坏，立即抛错而非 silent
    // 回落 enum（PR5c 兜底返回 `[]` 会被 dispatcher continue 吞掉 → IR 少 emit action）。
    throw new Error(
      `[#1313 PR6] action.add_position shape received unexpected action.type='${action.type}'`,
    )
  }
  return [{
    kind: action.type,
    quantity: resolveOpenOrAddQuantity(actionInput, spec, fallback, helpers.resolveActionQuantity),
  }]
}

/**
 * mirror `compileActions` 内 reverse_position 展开后两条独立 action（一条 CLOSE_*，一条
 *   OPEN_*；builder `buildActionsForSemanticLifecycleAction` L2127-L2138 写入），每条
 *   action 独立携带 atomKey='action.reverse_position'。dispatcher per-action 调度本 shape，
 *   按 action.type 分流为 CLOSE 或 OPEN 形态。
 */
const reversePositionActionShape: ActionShape = (_atom, actionInput, _rule, spec, fallback, { helpers }) => {
  const action = actionInput as unknown as CanonicalRuleAction
  if (action.type === 'CLOSE_LONG' || action.type === 'CLOSE_SHORT') {
    return [{ kind: action.type, quantity: CLOSE_FULL_POSITION_QUANTITY }]
  }
  if (action.type === 'OPEN_LONG' || action.type === 'OPEN_SHORT') {
    return [{
      kind: action.type,
      quantity: resolveOpenOrAddQuantity(actionInput, spec, fallback, helpers.resolveActionQuantity),
    }]
  }
  // PR6 fail-loud：builder 永远只在 OPEN/CLOSE 4 种 action.type 挂载本 atomKey；
  // 到达此分支说明 spec 漂移或 builder 透传被破坏（同 add_position 守门）。
  throw new Error(
    `[#1313 PR6] action.reverse_position shape received unexpected action.type='${action.type}'`,
  )
}

export const ACTION_ATOM_EMITS = {
  'action.open_long': {
    capabilityStatus: 'pr3e-action',
    actionShape: openLongActionShape,
  },
  'action.open_short': {
    capabilityStatus: 'pr3e-action',
    actionShape: openShortActionShape,
  },
  'action.close_long': {
    capabilityStatus: 'pr3e-action',
    actionShape: closeLongActionShape,
  },
  'action.close_short': {
    capabilityStatus: 'pr3e-action',
    actionShape: closeShortActionShape,
  },
  'action.add_position': {
    capabilityStatus: 'pr3e-action',
    actionShape: addPositionActionShape,
  },
  'action.reverse_position': {
    capabilityStatus: 'pr3e-action',
    actionShape: reversePositionActionShape,
  },
} satisfies Partial<Record<AtomContractKey, ActionEmitOverride>>
