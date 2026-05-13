/**
 * RISK_GUARD_ATOM_EMITS — Issue #1313 PR2 兑现的 2 个 rule-level RiskGuard 类 atom
 * 的 `emit.riskGuardShape` 真实实现。
 *
 * 行为与 `canonical-spec-v2-ir-compiler.service.ts#tryCompileRiskGuard` 内
 *   `position.has_position` / `position.no_position` 的 atom-specific 分支
 *   (合并前 L2568-L2592) 严格等价：phase=gate + op=EQ + value=false +
 *   BLOCK_NEW_ENTRY 时返回 MAX_POSITION_PCT guard，sideScope 优先取
 *   `condition.params.side`（builder 写入），fallback 到 `rule.sideScope`。
 *
 * IR snapshot byte-equal 由 canonical-spec-v2-ir-compiler.service.spec.ts 守门。
 */

import type { CanonicalRuleSideScope } from '../types/canonical-strategy-spec'
import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'
import type { RiskGuardShape } from './atom-contract-emit.types'

/** 与 RuleLikeInput 同形，但显式声明 RiskGuard emit 实际消费的字段（透出守门）。
 *
 *  Review P3 修复：`sideScope` 直接复用 `CanonicalRuleSideScope`（含 `'flat'`），
 *  避免与上游 canonical-strategy-spec 漂移；运行时 `'flat'` 经 `toAppliesTo` 收敛为
 *  `'both'`，与 ir-compiler service `toRiskGuardAppliesTo` 等价。
 */
interface RiskGuardRuleLike {
  readonly id: string
  readonly phase?: string
  readonly sideScope?: CanonicalRuleSideScope | undefined
  readonly actions?: ReadonlyArray<{ readonly type?: string }>
}

/** 复刻 ir-compiler service 内 `toRiskGuardAppliesTo`（L3409-L3412）。 */
function toAppliesTo(sideScope: RiskGuardRuleLike['sideScope']): 'long' | 'short' | 'both' {
  if (sideScope === 'long' || sideScope === 'short') return sideScope
  return 'both'
}

/**
 * 仅覆盖 `capabilityStatus` + `riskGuardShape` 两个字段。`capability` 三元组、
 * `evidenceSource` 与 `irShape`（NotApplicable sentinel）由 `createPr1bEmit` 基底继承，
 * 与现有 dispatcher snapshot 形态保持一致 —— 见 atom-contract-registry.ts
 * `completePr1bRegistry` 合并逻辑。
 */
export type RiskGuardEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'riskGuardShape'>

/**
 * `position.has_position` / `position.no_position` 共享同一段 case body：
 *   phase=gate + condition.op=EQ + condition.value=false + actions 含 BLOCK_NEW_ENTRY
 *   → 返回 MAX_POSITION_PCT guard；任一守门不命中返回 null，由 dispatcher legacy 兜底。
 */
const positionPresenceRiskGuard: RiskGuardShape = (atom, rule, _ctx) => {
  const r = rule as unknown as RiskGuardRuleLike
  if (r.phase !== 'gate') return null
  if (atom.op !== 'EQ') return null
  if (atom.value !== false) return null
  const actions = Array.isArray(r.actions) ? r.actions : []
  if (!actions.some(action => action?.type === 'BLOCK_NEW_ENTRY')) return null

  // critic round 1 C-A2 修复：必须传 appliesTo 以保留 sideScope 语义
  // ("已有多头仓位时不再开多" 必须只阻止做多，不能阻止做空)；
  // 没传时 silent collapse 为全方向 block。
  // sideScope 优先从 condition.params.side 取（builder 写入），
  // fallback 到 rule.sideScope（顶层规则方向）。
  const conditionSide = (atom.params as { side?: string } | undefined)?.side
  const effectiveSide = (conditionSide === 'long' || conditionSide === 'short' || conditionSide === 'both')
    ? conditionSide
    : r.sideScope
  return {
    id: `guard_${r.id}`,
    kind: 'MAX_POSITION_PCT',
    scope: 'position',
    value: 0,
    onBreach: 'BLOCK_NEW_ENTRY',
    appliesTo: toAppliesTo(effectiveSide),
  }
}

export const RISK_GUARD_ATOM_EMITS = {
  'position.has_position': {
    capabilityStatus: 'pr3e-risk-guard',
    riskGuardShape: positionPresenceRiskGuard,
  },
  'position.no_position': {
    capabilityStatus: 'pr3e-risk-guard',
    riskGuardShape: positionPresenceRiskGuard,
  },
} satisfies Partial<Record<AtomContractKey, RiskGuardEmitOverride>>
