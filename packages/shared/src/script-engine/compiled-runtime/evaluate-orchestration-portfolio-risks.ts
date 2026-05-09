/**
 * Orchestration portfolioRisk evaluator (Phase 5 S7, issue #984).
 *
 * Fail-closed semantics:
 *   - drawdownPct 缺失（undefined / NaN）+ enforce → fail-closed double block
 *   - drawdownPct 缺失 + observe → 完全 no-op（不阻挡、不入 observedBreaches，无 evidence 不记录）
 *   - 非法 contract（thresholdPct ≤0 / 非 finite）→ fail-closed double block (无视 mode)
 *   - drawdownPct < threshold → 未触发（含 dd<=0 即 equity 增长）
 *   - enforce 触发 → blockEntryLong/Short = true
 *   - observe 触发 → observedBreaches 含该 risk.id（不阻挡）
 *
 * 仅作用于 OPEN_* 决策（与 gate.regime 同链路；运行时聚合在 run-decision-programs 实现）；
 * CLOSE_* / REDUCE_* / forceExit 不受影响（issue #984 bullet #6 安全保证）。
 */
import type { OrchestrationGateState } from './evaluate-orchestration-gates'

export interface CompiledOrchestrationPortfolioRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number // 0..100 浮点（"10" 表 10%），与 ctx.accountDrawdownPct 同单位
  effectWhenTriggered: 'block_new_entries'
}

export interface PortfolioRuntimeContext {
  drawdownPct?: number // 0..100 正数；equity 增长时 0 或负
}

export interface OrchestrationPortfolioRiskState extends OrchestrationGateState {
  observedBreaches: string[]
}

export function evaluateOrchestrationPortfolioRisks(
  risks: readonly CompiledOrchestrationPortfolioRisk[],
  ctx: PortfolioRuntimeContext,
): OrchestrationPortfolioRiskState {
  let blockLong = false
  let blockShort = false
  const observedBreaches: string[] = []
  for (const risk of risks) {
    if (risk.scope !== 'portfolio') continue
    if (!Number.isFinite(risk.thresholdPct) || risk.thresholdPct <= 0) {
      // 非法 contract → fail-closed double block 无视 mode
      blockLong = true
      blockShort = true
      continue
    }
    const dd = ctx.drawdownPct
    if (!Number.isFinite(dd)) {
      // 无 evidence：enforce 走 fail-closed double block；observe 完全 no-op
      if (risk.mode === 'enforce') {
        blockLong = true
        blockShort = true
      }
      continue
    }
    if ((dd as number) < risk.thresholdPct) continue // 未触发（含 dd<=0 equity 增长）
    if (risk.mode === 'enforce') {
      blockLong = true
      blockShort = true
    } else {
      // observe
      observedBreaches.push(risk.id)
    }
  }
  return { blockEntryLong: blockLong, blockEntryShort: blockShort, observedBreaches }
}
