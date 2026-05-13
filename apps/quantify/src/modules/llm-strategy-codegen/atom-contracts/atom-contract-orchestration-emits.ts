/**
 * ORCHESTRATION_ATOM_EMITS — Issue #1313 PR3 兑现的 spec-level
 * `emit.orchestrationPortfolioRiskShape` 真实实现。
 *
 * 当前 1 atom：
 *   - `portfolioRisk.drawdown_block` ←→
 *     `canonical-spec-v2-ir-compiler.service.ts#compileOrchestrationPortfolioRisks` (L1051-L1086)
 *
 * 注：源头是 `spec.orchestration.portfolioRisks[]`（非 atom 自身），dispatcher 反查
 * `ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].emit.orchestrationPortfolioRiskShape`
 * 作为 IR 形态模板，对每条 `CanonicalOrchestrationPortfolioRisk` 调用一次完成 per-risk
 * emit。即"atom 实例是模板查询 key，运行期数据来自 spec.orchestration.portfolioRisks[]"。
 *
 * Phase 5 S8 (#1119) portfolioRisk union 三变体（`portfolio` / `symbol` / `subStrategy`）
 * 全部由本 shape 处理，与原 service 私有 `compileOrchestrationPortfolioRisks` 逐字段透传
 * 行为严格等价（IR snapshot byte-equal）。
 */

import type { IrOrchestrationPortfolioRisk } from '../types/canonical-strategy-ir'
import type { CanonicalOrchestrationPortfolioRisk } from '../types/canonical-strategy-spec-v2'
import type { OrchestrationPortfolioRiskShape } from './atom-contract-emit.types'
import type { AtomContractEmit, AtomContractKey } from './atom-contract-types'

export type OrchestrationEmitOverride = Pick<AtomContractEmit, 'capabilityStatus' | 'orchestrationPortfolioRiskShape'>

// `OrchestrationPortfolioRiskLikeInput` 仍是 `Readonly<Record<string, unknown>>` 占位
// （PR2/PR4 兼容），shape 内显式 cast 到 canonical union 类型再走分支。
//
// mirror service 私有 `compileOrchestrationPortfolioRisks` per-risk body
//   @ canonical-spec-v2-ir-compiler.service.ts:1051-1086
const drawdownBlockOrchestrationShape: OrchestrationPortfolioRiskShape = (riskInput) => {
  const risk = riskInput as unknown as CanonicalOrchestrationPortfolioRisk
  let out: IrOrchestrationPortfolioRisk
  if (risk.scope === 'portfolio') {
    out = {
      id: risk.id,
      scope: 'portfolio',
      mode: risk.mode,
      thresholdPct: risk.thresholdPct,
      effectWhenTriggered: risk.effectWhenTriggered,
    }
  }
  else if (risk.scope === 'symbol') {
    out = {
      id: risk.id,
      scope: 'symbol',
      mode: risk.mode,
      notionalCapPct: risk.notionalCapPct,
      symbolScopeRef: risk.symbolScopeRef,
      effectWhenTriggered: risk.effectWhenTriggered,
    }
  }
  else {
    // scope === 'subStrategy'
    out = {
      id: risk.id,
      scope: 'subStrategy',
      mode: risk.mode,
      notionalCapPct: risk.notionalCapPct,
      subStrategyScopeRef: risk.subStrategyScopeRef,
      effectWhenTriggered: risk.effectWhenTriggered,
    }
  }
  return out
}

export const ORCHESTRATION_ATOM_EMITS = {
  'portfolioRisk.drawdown_block': {
    capabilityStatus: 'pr3e-orchestration-portfolio',
    orchestrationPortfolioRiskShape: drawdownBlockOrchestrationShape,
  },
} satisfies Partial<Record<AtomContractKey, OrchestrationEmitOverride>>
