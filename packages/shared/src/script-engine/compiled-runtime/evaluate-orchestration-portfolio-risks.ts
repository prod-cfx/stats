/**
 * Orchestration portfolioRisk evaluator (Phase 5 S7 #1057 / S8 #1119, issue #984).
 *
 * Phase 5 S8 (#1119): CompiledOrchestrationPortfolioRisk 升级为 discriminated union
 *   - scope='portfolio' (drawdown_block) — S7 既有
 *   - scope='symbol'    (symbol_exposure_cap)
 *   - scope='subStrategy' (substrategy_exposure_cap)
 *
 * Fail-closed semantics（每变体独立但同形）：
 *   - drawdown: drawdownPct 缺失/NaN + enforce → 全局 fail-closed double block
 *   - symbol:   exposureNotional 缺/equity 缺/equity ≤0 + enforce → bound symbol scope 加入 blockedSymbolScopeRefs
 *   - subStrategy: 同 symbol 镜像（pause_substrategy → pausedSubStrategyScopeRefs；block_new_entries → blockedSubStrategyScopeRefs）
 *   - 非法 contract（thresholdPct/notionalCapPct ≤0 / 非 finite）→ fail-closed bound scope（drawdown 走全局，symbol/sub 走 scoped）
 *   - observe + 缺 evidence → 完全 no-op（不入 observedBreaches，与 S7 收敛一致）
 *
 * 仅作用于 OPEN_* 决策（与 gate.regime 同链路；运行时聚合在 run-decision-programs 实现）；
 * CLOSE_* / REDUCE_* / forceExit 不受影响（issue #984 第 6 条安全保证）。
 *
 * Linus Good Taste：discriminated union switch on scope，evaluator 单 for-loop 派发，
 * 不为新 effect 生造独立 evaluator。
 */
import type { OrchestrationGateState } from './evaluate-orchestration-gates'

// Phase 5 S7：drawdown_block
export interface CompiledPortfolioDrawdownRisk {
  id: string
  scope: 'portfolio'
  mode: 'observe' | 'enforce'
  thresholdPct: number // 0..100 浮点（"10" 表 10%），与 ctx.drawdownPct 同单位
  effectWhenTriggered: 'block_new_entries'
}

// Phase 5 S8 #1119：symbol exposure cap
export interface CompiledPortfolioSymbolExposureCapRisk {
  id: string
  scope: 'symbol'
  mode: 'observe' | 'enforce'
  notionalCapPct: number // (0, 100] 单标的占账户 equity 名义敞口上限
  symbolScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'reduce_exposure'
}

// Phase 5 S8 #1119：substrategy exposure cap
export interface CompiledPortfolioSubStrategyExposureCapRisk {
  id: string
  scope: 'subStrategy'
  mode: 'observe' | 'enforce'
  notionalCapPct: number
  subStrategyScopeRef: string
  effectWhenTriggered: 'block_new_entries' | 'pause_substrategy'
}

// Phase 5 S8：discriminator scope
export type CompiledOrchestrationPortfolioRisk =
  | CompiledPortfolioDrawdownRisk
  | CompiledPortfolioSymbolExposureCapRisk
  | CompiledPortfolioSubStrategyExposureCapRisk

export interface PortfolioRuntimeContext {
  drawdownPct?: number // 0..100 正数；equity 增长时 0 或负
  // Phase 5 S8 #1119: 名义敞口聚合（按 scope id 索引）
  exposureNotionalBySymbolScope?: Readonly<Record<string, number>>
  exposureNotionalBySubStrategyScope?: Readonly<Record<string, number>>
  // Phase 5 S8 #1119: 账户 equity（来自 readContextEquity / portfolio.totalEquityUsd）
  accountEquity?: number
}

export interface OrchestrationPortfolioRiskState extends OrchestrationGateState {
  observedBreaches: string[]
  // Phase 5 S8 #1119: scoped block / pause / reduce 集合（仅触发时存在，不存在表示无）
  blockedSymbolScopeRefs?: ReadonlySet<string>
  reduceFactorBySymbolScope?: Readonly<Record<string, number>>
  pausedSubStrategyScopeRefs?: ReadonlySet<string>
  blockedSubStrategyScopeRefs?: ReadonlySet<string>
}

function isFinitePositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

function handlePortfolioDrawdown(
  risk: CompiledPortfolioDrawdownRisk,
  ctx: PortfolioRuntimeContext,
  out: { blockLong: boolean; blockShort: boolean; observedBreaches: string[] },
): void {
  if (!isFinitePositive(risk.thresholdPct)) {
    // 非法 contract → fail-closed double block 无视 mode
    out.blockLong = true
    out.blockShort = true
    return
  }
  const dd = ctx.drawdownPct
  if (!Number.isFinite(dd)) {
    // 无 evidence：enforce → fail-closed；observe → 完全 no-op
    if (risk.mode === 'enforce') {
      out.blockLong = true
      out.blockShort = true
    }
    return
  }
  if ((dd as number) < risk.thresholdPct) return
  if (risk.mode === 'enforce') {
    out.blockLong = true
    out.blockShort = true
  } else {
    out.observedBreaches.push(risk.id)
  }
}

function handleSymbolExposureCap(
  risk: CompiledPortfolioSymbolExposureCapRisk,
  ctx: PortfolioRuntimeContext,
  out: {
    observedBreaches: string[]
    blockedSymbolScopeRefs: Set<string>
    reduceFactorBySymbolScope: Record<string, number>
  },
): void {
  const ref = risk.symbolScopeRef
  // 非法 contract / 非法 ref → enforce 走 fail-closed bound scope；observe no-op
  const capInvalid = !isFinitePositive(risk.notionalCapPct) || risk.notionalCapPct > 100
  const refInvalid = typeof ref !== 'string' || ref.trim() === ''
  if (capInvalid || refInvalid) {
    if (!refInvalid && risk.mode === 'enforce') out.blockedSymbolScopeRefs.add(ref)
    return
  }
  const notional = ctx.exposureNotionalBySymbolScope?.[ref]
  const equity = ctx.accountEquity
  // 缺 evidence：enforce → fail-closed bound scope；observe → 完全 no-op
  if (typeof notional !== 'number' || !Number.isFinite(notional) || typeof equity !== 'number' || !Number.isFinite(equity) || equity <= 0) {
    if (risk.mode === 'enforce') out.blockedSymbolScopeRefs.add(ref)
    return
  }
  const ratio = (notional / equity) * 100
  if (ratio < risk.notionalCapPct) return // 未触发
  if (risk.mode === 'observe') {
    out.observedBreaches.push(risk.id)
    return
  }
  // enforce
  if (risk.effectWhenTriggered === 'block_new_entries') {
    out.blockedSymbolScopeRefs.add(ref)
    return
  }
  // reduce_exposure：factor = cap/ratio，多 risk 同 ref 取最严（最小 factor）
  const factor = risk.notionalCapPct / ratio
  const prev = out.reduceFactorBySymbolScope[ref]
  out.reduceFactorBySymbolScope[ref] = prev === undefined ? factor : Math.min(prev, factor)
}

function handleSubStrategyExposureCap(
  risk: CompiledPortfolioSubStrategyExposureCapRisk,
  ctx: PortfolioRuntimeContext,
  out: {
    observedBreaches: string[]
    pausedSubStrategyScopeRefs: Set<string>
    blockedSubStrategyScopeRefs: Set<string>
  },
): void {
  const ref = risk.subStrategyScopeRef
  const capInvalid = !isFinitePositive(risk.notionalCapPct) || risk.notionalCapPct > 100
  const refInvalid = typeof ref !== 'string' || ref.trim() === ''
  if (capInvalid || refInvalid) {
    if (!refInvalid && risk.mode === 'enforce') {
      // fail-closed：sub-strategy 维度任一非法 → 选最严即 blocked + paused（统一拦 OPEN_* 与跳 program）
      if (risk.effectWhenTriggered === 'pause_substrategy') {
        out.pausedSubStrategyScopeRefs.add(ref)
      } else {
        out.blockedSubStrategyScopeRefs.add(ref)
      }
    }
    return
  }
  const notional = ctx.exposureNotionalBySubStrategyScope?.[ref]
  const equity = ctx.accountEquity
  if (typeof notional !== 'number' || !Number.isFinite(notional) || typeof equity !== 'number' || !Number.isFinite(equity) || equity <= 0) {
    if (risk.mode === 'enforce') {
      if (risk.effectWhenTriggered === 'pause_substrategy') {
        out.pausedSubStrategyScopeRefs.add(ref)
      } else {
        out.blockedSubStrategyScopeRefs.add(ref)
      }
    }
    return
  }
  const ratio = (notional / equity) * 100
  if (ratio < risk.notionalCapPct) return
  if (risk.mode === 'observe') {
    out.observedBreaches.push(risk.id)
    return
  }
  if (risk.effectWhenTriggered === 'pause_substrategy') {
    out.pausedSubStrategyScopeRefs.add(ref)
  } else {
    out.blockedSubStrategyScopeRefs.add(ref)
  }
}

export function evaluateOrchestrationPortfolioRisks(
  risks: readonly CompiledOrchestrationPortfolioRisk[],
  ctx: PortfolioRuntimeContext,
): OrchestrationPortfolioRiskState {
  const out = {
    blockLong: false,
    blockShort: false,
    observedBreaches: [] as string[],
    blockedSymbolScopeRefs: new Set<string>(),
    reduceFactorBySymbolScope: {} as Record<string, number>,
    pausedSubStrategyScopeRefs: new Set<string>(),
    blockedSubStrategyScopeRefs: new Set<string>(),
  }
  for (const risk of risks) {
    // byte-equal 兼容：旧 IR JSON 缺 scope 字段（reader default 'portfolio'）走 drawdown 分支
    const scope = (risk as { scope?: string }).scope ?? 'portfolio'
    if (scope === 'portfolio') {
      handlePortfolioDrawdown(risk as CompiledPortfolioDrawdownRisk, ctx, out)
    } else if (scope === 'symbol') {
      handleSymbolExposureCap(risk as CompiledPortfolioSymbolExposureCapRisk, ctx, out)
    } else if (scope === 'subStrategy') {
      handleSubStrategyExposureCap(risk as CompiledPortfolioSubStrategyExposureCapRisk, ctx, out)
    }
    // 未知 scope 静默忽略（fail-closed 不会被触发，正常路径不会进）
  }
  const state: OrchestrationPortfolioRiskState = {
    blockEntryLong: out.blockLong,
    blockEntryShort: out.blockShort,
    observedBreaches: out.observedBreaches,
  }
  if (out.blockedSymbolScopeRefs.size > 0) state.blockedSymbolScopeRefs = out.blockedSymbolScopeRefs
  if (Object.keys(out.reduceFactorBySymbolScope).length > 0) state.reduceFactorBySymbolScope = out.reduceFactorBySymbolScope
  if (out.pausedSubStrategyScopeRefs.size > 0) state.pausedSubStrategyScopeRefs = out.pausedSubStrategyScopeRefs
  if (out.blockedSubStrategyScopeRefs.size > 0) state.blockedSubStrategyScopeRefs = out.blockedSubStrategyScopeRefs
  return state
}
