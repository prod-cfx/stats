/**
 * RISK_PREDICATE_ATOM_EMITS — Issue #1498 兑现的 risk-level RiskPredicate 类 atom 的
 * `emit.riskPredicateShape` 真实实现。
 *
 * 行为与 `canonical-spec-v2-ir-compiler.service.ts#tryCompileRiskPredicate` 内
 *   `risk.atr_take_profit` / `risk.atr_multiple_stop` /
 *   `risk.atr_multiple_take_profit` / `risk.remembered_level_stop` 的
 *   atom-specific 分支 body 严格等价（IR snapshot byte-equal）。
 *
 * dispatcher 端（`tryCompileRiskPredicate`）按 `rule.condition.key` 反查 REGISTRY，
 *   命中 `capabilityStatus === 'pr3e-risk-predicate'` + `emit.riskPredicateShape`
 *   即调度，返回 null 时 fall-through 到 legacy switch 兜底。
 */

import type { RiskPredicateDef } from '../types/canonical-strategy-ir'
import type { RiskPredicateShape, RuleLikeInput } from './atom-contract-emit.types'
import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'

/**
 * 仅覆盖 `capabilityStatus` + `riskPredicateShape` 两个字段。`capability` 三元组、
 * `evidenceSource` 与 sentinel `irShape` 由 `createPr1bEmit` 继承（与
 * `RiskGuardEmitOverride` / `ActionEmitOverride` 同形）。
 */
export type RiskPredicateEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'riskPredicateShape'>

interface RiskPredicateRuleLike {
  readonly id: string
}

function readNumberLocal(candidates: ReadonlyArray<unknown>, fallback: number): number {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }
  return fallback
}

/**
 * mirror ir-compiler `risk.atr_take_profit` case body（L2891-L2912）。
 *   - multiple 必填，<=0 抛 condition_unsupported（与 ir-compiler fail-loud 一致）
 *   - period 默认 14
 *   - runtimeRequirements.helpers += 'atr'
 *   - kind = 'atrMultipleTakeProfit'（复用 multiple TP 形态，但额外带 period）
 */
const atrTakeProfitShape: RiskPredicateShape = (atom, rule, { compileContext: c }, compileRiskPredicateActions) => {
  const r = rule as unknown as RiskPredicateRuleLike
  const multiple = readNumberLocal(
    [atom.params?.multiple, atom.params?.multiplier],
    0,
  )
  if (multiple <= 0) {
    throw new Error(`codegen.canonical_spec_v2_condition_unsupported:${atom.key}:multiple`)
  }
  const period = readNumberLocal([atom.params?.period, atom.params?.atrPeriod], 14)
  c.runtimeRequirements.helpers.add('atr')
  return {
    id: r.id,
    kind: 'atrMultipleTakeProfit',
    params: { multiple, period },
    actions: compileRiskPredicateActions(rule),
  }
}

/**
 * mirror ir-compiler `risk.atr_multiple_stop` / `risk.atr_multiple_take_profit`
 *   合并分支（L2877-L2889）：multiple 必填 > 0，否则返回 null（dispatcher fall-through）。
 */
function makeAtrMultipleShape(kind: 'atrMultipleStop' | 'atrMultipleTakeProfit'): RiskPredicateShape {
  return (atom, rule, { compileContext: c }, compileRiskPredicateActions) => {
    const r = rule as unknown as RiskPredicateRuleLike
    const multiple = readNumberLocal([atom.params?.multiple], 0)
    if (multiple <= 0) {
      return null
    }
    c.runtimeRequirements.helpers.add('atr')
    return {
      id: r.id,
      kind,
      params: { multiple },
      actions: compileRiskPredicateActions(rule),
    }
  }
}

/**
 * mirror ir-compiler `risk.remembered_level_stop` case body（L2984-L2998）。
 *   - levelKey 必填非空字符串
 *   - stateKeys += levelKey（与 S2 memoryKey 走同一通道）
 *   - kind = 'rememberedLevelStop'
 */
const rememberedLevelStopShape: RiskPredicateShape = (atom, rule, { compileContext: c }, compileRiskPredicateActions) => {
  const r = rule as unknown as RiskPredicateRuleLike
  const levelKeyRaw = atom.params?.levelKey
  const levelKey = typeof levelKeyRaw === 'string' && levelKeyRaw.trim().length > 0
    ? levelKeyRaw.trim()
    : null
  if (!levelKey) {
    return null
  }
  c.runtimeRequirements.stateKeys.add(levelKey)
  return {
    id: r.id,
    kind: 'rememberedLevelStop',
    params: { levelKey },
    actions: compileRiskPredicateActions(rule),
  }
}

export const RISK_PREDICATE_ATOM_EMITS = {
  'risk.atr_take_profit': {
    capabilityStatus: 'pr3e-risk-predicate',
    riskPredicateShape: atrTakeProfitShape,
  },
  'risk.atr_multiple_stop': {
    capabilityStatus: 'pr3e-risk-predicate',
    riskPredicateShape: makeAtrMultipleShape('atrMultipleStop'),
  },
  'risk.atr_multiple_take_profit': {
    capabilityStatus: 'pr3e-risk-predicate',
    riskPredicateShape: makeAtrMultipleShape('atrMultipleTakeProfit'),
  },
  'risk.remembered_level_stop': {
    capabilityStatus: 'pr3e-risk-predicate',
    riskPredicateShape: rememberedLevelStopShape,
  },
} satisfies Partial<Record<AtomContractKey, RiskPredicateEmitOverride>>

// Re-export RiskPredicateDef for spec consumers convenience.
export type { RiskPredicateDef }
