import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import { atr } from '../helpers/technical-indicators'
import type {
  CompiledAdaptiveVolatilityGridProgram,
  CompiledFixedGridGatedProgram,
  CompiledOrchestrationProgram,
} from './compiled-orchestration-program'
import { isValidAdaptiveVolatilityGrid } from './compiled-orchestration-program'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'
import type { ProgramLifecycleState } from './program-lifecycle-state'

interface OrderProgramNode {
  id: string
  sourceRef: string
  payload?: unknown
}

export interface CompiledOrderState {
  workingOrders: ReadonlyArray<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }>
  activeProgramIds: readonly string[]
  cancelledProgramIds: readonly string[]
  closeProgramIds: readonly string[]
  // Phase 5 S0a: program lifecycle 跨 K 线状态通道；S6 adaptive_volatility_grid 写入深 freeze entry。
  programLifecycleStateNext: Readonly<Record<string, ProgramLifecycleState>>
}

// Phase 5 S6 (#984) — adaptive_volatility_grid runtime 失败 reason
const REASON_ATR_UNAVAILABLE_KEEP_LADDER = 'compiled.orchestration.program.atr_unavailable_keep_ladder'
const REASON_ATR_UNAVAILABLE_NO_PRIOR_LADDER = 'compiled.orchestration.program.atr_unavailable_no_prior_ladder'
const REASON_REBUILD_THROTTLED = 'compiled.orchestration.program.rebuild_throttled'
const REASON_ATR_INVALID_COMPUTATION = 'compiled.orchestration.program.atr_invalid_computation'

export function runOrderPrograms(
  ctx: StrategyExecutionContextV1,
  programs: readonly OrderProgramNode[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  orderProgramOrder: readonly string[],
  _executionModel?: Record<string, unknown>,
  orchestrationPrograms?: readonly CompiledOrchestrationProgram[],
  // Phase 5 S0a: 第 8 参 — 上一根 K 线产出的 lifecycle 状态（按 program.id 索引）。
  programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>,
): Readonly<CompiledOrderState> {
  // ---------- Orchestration program lifecycle (Phase 5 S4 T11 + S6 adaptive) ----------
  const orchWorkingOrders: Array<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }> = []
  const orchActiveIds: string[] = []
  const orchCancelledIds: string[] = []
  const orchCloseIds: string[] = []
  // Phase 5 S0a: 跨 K 线 lifecycle 状态出向通道（按 program.id 索引）。
  const programLifecycleStateNext: Record<string, ProgramLifecycleState> = {}

  if (orchestrationPrograms && orchestrationPrograms.length > 0) {
    for (const program of orchestrationPrograms) {
      if (program.programKind === 'fixed_grid_gated') {
        runFixedGridGatedProgram({
          program,
          exprValues,
          guardState,
          orchWorkingOrders,
          orchActiveIds,
          orchCancelledIds,
          orchCloseIds,
          programLifecycleStateNext,
        })
        continue
      }
      if (program.programKind === 'adaptive_volatility_grid') {
        runAdaptiveVolatilityGridProgram({
          ctx,
          program,
          exprValues,
          guardState,
          programLifecycleStateIn,
          orchWorkingOrders,
          orchActiveIds,
          orchCancelledIds,
          orchCloseIds,
          programLifecycleStateNext,
        })
        continue
      }
    }
  }

  // ---------- Legacy program loop (unchanged) ----------
  const programIndex = new Map(programs.map(program => [program.id, program]))

  const orderedPrograms = orderProgramOrder
    .map(id => programIndex.get(id))
    .filter((program): program is OrderProgramNode => program !== undefined)
  const activePrograms = guardState.cancelOrderPrograms
    ? []
    : orderedPrograms.filter(program => isOrderProgramActive(program, exprValues))
  const inactiveProgramIds = guardState.cancelOrderPrograms
    ? []
    : orderedPrograms
      .filter(program => !isOrderProgramActive(program, exprValues))
      .map(program => program.id)

  const legacyWorkingOrders = activePrograms.map(program => buildWorkingOrder(program, exprValues))
  const legacyActiveIds = activePrograms.map(program => program.id)
  const legacyCancelledIds = guardState.cancelOrderPrograms ? [...orderProgramOrder] : inactiveProgramIds

  return Object.freeze({
    workingOrders: Object.freeze([...orchWorkingOrders, ...legacyWorkingOrders]),
    activeProgramIds: Object.freeze([...orchActiveIds, ...legacyActiveIds]),
    cancelledProgramIds: Object.freeze([...orchCancelledIds, ...legacyCancelledIds]),
    closeProgramIds: Object.freeze([...orchCloseIds]),
    programLifecycleStateNext: Object.freeze(programLifecycleStateNext),
  })
}

// ----------- fixed_grid_gated 分支（S4，逐字段保持） -----------

interface FixedGridGatedRunArgs {
  program: CompiledFixedGridGatedProgram
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>
  guardState: Readonly<CompiledGuardState>
  orchWorkingOrders: Array<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }>
  orchActiveIds: string[]
  orchCancelledIds: string[]
  orchCloseIds: string[]
  programLifecycleStateNext: Record<string, ProgramLifecycleState>
}

function runFixedGridGatedProgram(args: FixedGridGatedRunArgs): void {
  const {
    program, exprValues, guardState,
    orchWorkingOrders, orchActiveIds, orchCancelledIds, orchCloseIds,
    programLifecycleStateNext,
  } = args
  if (guardState.cancelOrderPrograms) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }
    return
  }

  if (!isValidFixedGridGated(program)) {
    orchCancelledIds.push(program.id)
    return
  }

  const exprValue = exprValues[program.activeWhenExprId]
  const isActive = exprValue === true
  programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }

  if (isActive) {
    orchActiveIds.push(program.id)
    orchWorkingOrders.push(buildFixedGridGatedWorkingOrder(program))
    return
  }

  switch (program.onDeactivate) {
    case 'cancel':
      orchCancelledIds.push(program.id)
      break
    case 'keep':
      orchWorkingOrders.push(buildFixedGridGatedWorkingOrder(program))
      break
    case 'close':
      orchCloseIds.push(program.id)
      break
  }
}

function isValidFixedGridGated(program: CompiledFixedGridGatedProgram): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  const { gridParams, sizing } = program
  if (!gridParams) return false
  if (!Number.isFinite(gridParams.anchorPrice) || gridParams.anchorPrice <= 0) return false
  if (!Number.isFinite(gridParams.stepPct) || gridParams.stepPct <= 0) return false
  if (!Number.isInteger(gridParams.levelCount) || gridParams.levelCount < 2) return false
  if (!sizing || !Number.isFinite(sizing.value) || sizing.value <= 0) return false
  return true
}

function buildFixedGridGatedWorkingOrder(program: CompiledFixedGridGatedProgram): {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
} {
  const { gridParams, sizing, activeWhenExprId } = program
  const decay = 1 - gridParams.stepPct / 100
  const rawLevels: number[] = []
  for (let i = 0; i < gridParams.levelCount; i++) {
    const level = round2(gridParams.anchorPrice * decay ** (i + 1))
    if (gridParams.lowerBound !== undefined && level < gridParams.lowerBound) continue
    if (gridParams.upperBound !== undefined && level > gridParams.upperBound) continue
    rawLevels.push(level)
  }

  return {
    id: program.id,
    sourceRef: 'orchestration:program.fixed_grid_gated',
    payload: {
      activeWhen: activeWhenExprId,
      gridParams: { ...gridParams },
      sizing: { ...sizing },
    },
    levels: Object.freeze(rawLevels),
  }
}

// ----------- adaptive_volatility_grid 分支（S6 八路径） -----------
//
// 8 路径（plan v3 Acceptance Runtime）：
//   1) fail-closed: isValidAdaptiveVolatilityGrid === false → cancelled
//   2) inline atr() helper（来自 @ai/shared/script-engine/helpers/technical-indicators）
//   3) active 状态判断
//   4) inactive 分支按 onDeactivate cancel/keep/close
//   5) ATR 计算（atr(ctx.bars, atrPeriod) → number | null）
//   6) ATR 不可用 Path A（有 prev → keep prev ladder + reason）/
//      Path B（无 prev → cancelled + key 缺席 + reason）
//   7) ATR rebuild 决策（drift / cooldown 钳制 / NaN 安全网）
//   8) deterministic now: ctx.timestamp ?? bars[last].timestamp（禁 Date.now()）

interface AdaptiveRunArgs {
  ctx: StrategyExecutionContextV1
  program: CompiledAdaptiveVolatilityGridProgram
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>
  guardState: Readonly<CompiledGuardState>
  programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>
  orchWorkingOrders: Array<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }>
  orchActiveIds: string[]
  orchCancelledIds: string[]
  orchCloseIds: string[]
  programLifecycleStateNext: Record<string, ProgramLifecycleState>
}

function runAdaptiveVolatilityGridProgram(args: AdaptiveRunArgs): void {
  const {
    ctx, program, exprValues, guardState, programLifecycleStateIn,
    orchWorkingOrders, orchActiveIds, orchCancelledIds, orchCloseIds,
    programLifecycleStateNext,
  } = args
  const prev = readAdaptivePrev(programLifecycleStateIn, program.id)

  // Path 4 应用 S5 M4：cancelOrderPrograms guard pass-through
  if (guardState.cancelOrderPrograms) {
    orchCancelledIds.push(program.id)
    if (prev) {
      programLifecycleStateNext[program.id] = prev
    }
    // 无 prev → key 缺席（与 S0a substrate adapter map merge 视为 eviction）
    return
  }

  // Path 1: 16 fail-closed
  if (!isValidAdaptiveVolatilityGrid(program)) {
    orchCancelledIds.push(program.id)
    return
  }

  // Path 3: active 状态判断
  const isActive = exprValues[program.activeWhenExprId] === true

  // Path 4: inactive 三模式 — 三 mode 在持有 prev 时均透传 lifecycle state，
  // 与 cancelOrderPrograms guard pass-through 语义对齐（critic round 3 fix）。
  // 防止 active→inactive(cancel)→active 抖动绕过 rebuildCooldownSec 硬下限：
  // 透传 prev 后再次 active 时仍按 drift / cooldown 比较，不会视为首次 build。
  if (!isActive) {
    switch (program.onDeactivate) {
      case 'cancel':
        orchCancelledIds.push(program.id)
        if (prev) {
          programLifecycleStateNext[program.id] = prev
        }
        break
      case 'keep':
        if (prev && prev.lastBuildLadder.length > 0) {
          orchWorkingOrders.push(buildAdaptiveWorkingOrderFromLadder(program, prev.lastBuildLadder, undefined))
          programLifecycleStateNext[program.id] = prev
        }
        else {
          orchCancelledIds.push(program.id)
        }
        break
      case 'close':
        orchCloseIds.push(program.id)
        if (prev) {
          programLifecycleStateNext[program.id] = prev
        }
        break
    }
    return
  }

  // Path 5: ATR 计算
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const currentATR = atr(bars, program.adaptiveGridParams.atrPeriod)

  // Path 6 ATR 不可用拆分两路径
  if (currentATR === null) {
    if (prev && prev.lastBuildLadder.length > 0) {
      // Path A: 保留 prev ladder + reason
      orchActiveIds.push(program.id)
      orchWorkingOrders.push(
        buildAdaptiveWorkingOrderFromLadder(program, prev.lastBuildLadder, REASON_ATR_UNAVAILABLE_KEEP_LADDER),
      )
      programLifecycleStateNext[program.id] = prev
      return
    }
    // Path B: 无 prev → cancelled + key 缺席（critic round 2 Major #2）
    orchCancelledIds.push(program.id)
    return
  }

  // Path 8: deterministic now（critic round 2 应用 S5 M3：禁 Date.now()）
  const lastBar = bars[bars.length - 1]
  const now = ctx.timestamp ?? lastBar?.timestamp
  const currentClose = lastBar?.close ?? Number.NaN

  // currentClose <= 0 安全网（critic round 2 Minor edge）
  if (!Number.isFinite(currentClose) || currentClose <= 0 || typeof now !== 'number') {
    orchCancelledIds.push(program.id)
    return
  }

  // Path 7: rebuild 决策
  const params = program.adaptiveGridParams

  // 首次 build（无 prev OR kind mismatch）→ 直接 rebuild（无 cooldown）
  if (!prev) {
    const rebuilt = tryRebuild({ program, currentATR, currentClose, now })
    if (!rebuilt) {
      orchCancelledIds.push(program.id)
      return
    }
    orchActiveIds.push(program.id)
    orchWorkingOrders.push(rebuilt.workingOrder)
    programLifecycleStateNext[program.id] = rebuilt.entry
    return
  }

  // 有 prev：drift 比较
  const atrDriftActual = (Math.abs(currentATR - prev.lastBuildATR) / prev.lastBuildATR) * 100

  if (atrDriftActual < params.atrDriftPct) {
    // 不 rebuild：keep prev ladder + 透传 prev state
    orchActiveIds.push(program.id)
    orchWorkingOrders.push(buildAdaptiveWorkingOrderFromLadder(program, prev.lastBuildLadder, undefined))
    programLifecycleStateNext[program.id] = prev
    return
  }

  // drift ≥ threshold + 距上次 < cooldown → throttled
  const elapsedSec = (now - prev.lastBuildAt) / 1000
  if (elapsedSec < params.rebuildCooldownSec) {
    orchActiveIds.push(program.id)
    orchWorkingOrders.push(buildAdaptiveWorkingOrderFromLadder(program, prev.lastBuildLadder, REASON_REBUILD_THROTTLED))
    programLifecycleStateNext[program.id] = prev
    return
  }

  // drift ≥ threshold + 距上次 ≥ cooldown → rebuild
  const rebuilt = tryRebuild({ program, currentATR, currentClose, now })
  if (!rebuilt) {
    orchCancelledIds.push(program.id)
    return
  }
  orchActiveIds.push(program.id)
  orchWorkingOrders.push(rebuilt.workingOrder)
  programLifecycleStateNext[program.id] = rebuilt.entry
}

function readAdaptivePrev(
  programLifecycleStateIn: Readonly<Record<string, ProgramLifecycleState>> | undefined,
  programId: string,
):
  | (Extract<ProgramLifecycleState, { kind: 'adaptive_volatility_grid' }>)
  | undefined {
  const entry = programLifecycleStateIn?.[programId]
  if (!entry || entry.kind !== 'adaptive_volatility_grid') return undefined
  return entry
}

interface RebuildResult {
  workingOrder: {
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }
  entry: ProgramLifecycleState
}

interface RebuildArgs {
  program: CompiledAdaptiveVolatilityGridProgram
  currentATR: number
  currentClose: number
  now: number
}

function tryRebuild(args: RebuildArgs): RebuildResult | null {
  const { program, currentATR, currentClose, now } = args
  const params = program.adaptiveGridParams

  const rawStep = params.atrMultiplier * currentATR

  // NaN/0/Inf 安全网（critic round 1 M2）
  if (
    !Number.isFinite(rawStep)
    || rawStep <= 0
    || !Number.isFinite(currentATR)
    || currentATR <= 0
    || !Number.isFinite(currentClose)
    || currentClose <= 0
  ) {
    return null
  }

  const rawStepPct = (rawStep / currentClose) * 100
  if (!Number.isFinite(rawStepPct) || rawStepPct <= 0) return null

  // 钳制
  const stepPct = Math.min(Math.max(rawStepPct, params.minStepPct), params.maxStepPct)
  const rebuildClamped = rawStepPct < params.minStepPct || rawStepPct > params.maxStepPct
  const range = params.rangeMultiplier * currentATR

  // 切分（critic round 2 Major #1）：lower=floor(N/2), upper=N-lower
  const lowerCount = Math.floor(params.levelCount / 2)
  const upperCount = params.levelCount - lowerCount

  const decay = 1 - stepPct / 100
  const growth = 1 + stepPct / 100
  const levels: Array<{ id: string; level: number }> = []

  for (let i = 0; i < lowerCount; i++) {
    const price = round2(currentClose * decay ** (i + 1))
    if (price < currentClose - range) continue
    if (!Number.isFinite(price) || price <= 0) continue
    levels.push({ id: `${program.id}_lower_${i + 1}`, level: price })
  }
  for (let j = 0; j < upperCount; j++) {
    const price = round2(currentClose * growth ** (j + 1))
    if (price > currentClose + range) continue
    if (!Number.isFinite(price) || price <= 0) continue
    levels.push({ id: `${program.id}_upper_${j + 1}`, level: price })
  }

  const frozenLadder = Object.freeze(levels.map(level => Object.freeze(level)))
  const entry: ProgramLifecycleState = Object.freeze({
    kind: 'adaptive_volatility_grid' as const,
    lastBuildATR: currentATR,
    lastBuildAt: now,
    lastBuildLadder: frozenLadder,
    rebuildClamped,
  })

  const workingOrder = buildAdaptiveWorkingOrderFromLadder(program, frozenLadder, undefined)
  return { workingOrder, entry }
}

function buildAdaptiveWorkingOrderFromLadder(
  program: CompiledAdaptiveVolatilityGridProgram,
  ladder: ReadonlyArray<{ id: string; level: number }>,
  reason: string | undefined,
): {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
} {
  const { activeWhenExprId, sizing, adaptiveGridParams } = program
  const levels = Object.freeze(ladder.map(item => item.level))
  const payload: Record<string, unknown> = {
    activeWhen: activeWhenExprId,
    adaptiveGridParams: { ...adaptiveGridParams },
    sizing: { ...sizing },
  }
  if (reason !== undefined) {
    payload.reason = reason
  }
  return {
    id: program.id,
    sourceRef: 'orchestration:program.adaptive_volatility_grid',
    payload,
    levels,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isOrderProgramActive(
  program: OrderProgramNode,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): boolean {
  const activeWhen = readStringProperty(program.payload, 'activeWhen')
  if (typeof activeWhen !== 'string' || activeWhen.length === 0 || activeWhen === 'always') {
    return true
  }
  return exprValues[activeWhen] === true
}

function buildWorkingOrder(
  program: OrderProgramNode,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
} {
  const payload = readPayloadRecord(program.payload)
  const levels = readLevelSetLevels(payload?.levelSetRef, exprValues)

  return {
    id: program.id,
    sourceRef: program.sourceRef,
    ...(payload ? { payload } : {}),
    ...(levels ? { levels } : {}),
  }
}

function readLevelSetLevels(
  levelSetRef: unknown,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): readonly number[] | undefined {
  if (typeof levelSetRef !== 'string' || levelSetRef.length === 0) return undefined

  const value = exprValues[levelSetRef]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const levels = (value as { levels?: unknown }).levels
  if (!Array.isArray(levels)) return undefined

  return levels.filter((level): level is number => Number.isFinite(level))
}

function readPayloadRecord(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  return { ...(payload as Record<string, unknown>) }
}

function readStringProperty(payload: unknown, key: string): string | undefined {
  const record = readPayloadRecord(payload)
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}
