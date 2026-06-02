import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import { atr } from '../helpers/technical-indicators'
import { canonicalSerialize } from './canonical-serialize'
import type {
  CompiledAdaptiveVolatilityGridProgram,
  CompiledDynamicGridProgram,
  CompiledEventListenerProgram,
  CompiledExecutionProgram,
  CompiledFixedGridGatedProgram,
  CompiledOrchestrationProgram,
} from './compiled-orchestration-program'
import {
  EVENT_LISTENER_DEDUP_BUFFER_CAPACITY,
  isValidAdaptiveVolatilityGrid,
  isValidEventListener,
  isExecutionProgram,
} from './compiled-orchestration-program'
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
  // Phase 5 S0a: program lifecycle 跨 K 线状态通道；S5 dynamic_grid + S6 adaptive_volatility_grid 写入深 freeze entry。
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
  // S5 dynamic_grid 消费 prev anchor / lastBuildAt / lastBuildLadder 用于 throttle / drift 判定。
  // S6 adaptive_volatility_grid 消费 prev ATR / lastBuildAt / lastBuildLadder。
  programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>,
): Readonly<CompiledOrderState> {
  // ---------- Orchestration program lifecycle (Phase 5 S4 T11 + S5 dynamic_grid + S6 adaptive) ----------
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
      if (program.programKind === 'dynamic_grid') {
        runDynamicGridProgram({
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
      // Phase 5 S12 (#1118): event_listener — 不发 working order；不进 closeProgramIds（W5 守护）
      if (program.programKind === 'event_listener') {
        runEventListenerProgram({
          ctx,
          program,
          exprValues,
          guardState,
          programLifecycleStateIn,
          orchActiveIds,
          orchCancelledIds,
          programLifecycleStateNext,
        })
        continue
      }
      if (isExecutionProgram(program)) {
        runExecutionProgram({
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

interface ExecutionProgramRunArgs {
  program: CompiledExecutionProgram
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

function runExecutionProgram(args: ExecutionProgramRunArgs): void {
  const {
    program,
    exprValues,
    guardState,
    orchWorkingOrders,
    orchActiveIds,
    orchCancelledIds,
    orchCloseIds,
    programLifecycleStateNext,
  } = args
  if (guardState.cancelOrderPrograms) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'cancelled' }
    return
  }
  if (!isValidExecutionProgram(program)) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'cancelled' }
    return
  }

  const isActive = exprValues[program.activeWhenExprId] === true
  if (isActive) {
    orchActiveIds.push(program.id)
    orchWorkingOrders.push({
      id: program.id,
      sourceRef: `orchestration:program.${program.programKind}`,
      payload: {
        programKind: program.programKind,
        activeWhen: program.activeWhenExprId,
        params: freezeRecord(program.params),
      },
    })
    programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'active' }
    return
  }

  switch (program.onDeactivate) {
    case 'cancel':
      orchCancelledIds.push(program.id)
      programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'cancelled' }
      break
    case 'keep':
      orchWorkingOrders.push({
        id: program.id,
        sourceRef: `orchestration:program.${program.programKind}`,
        payload: {
          programKind: program.programKind,
          activeWhen: program.activeWhenExprId,
          params: freezeRecord(program.params),
        },
      })
      programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'inactive' }
      break
    case 'close':
      orchCloseIds.push(program.id)
      programLifecycleStateNext[program.id] = { kind: program.programKind, status: 'closed' }
      break
  }
}

function isValidExecutionProgram(program: CompiledExecutionProgram): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  if (program.rebuildPolicy !== 'static') return false
  if (program.onDeactivate !== 'cancel' && program.onDeactivate !== 'keep' && program.onDeactivate !== 'close') return false
  return program.params !== null && typeof program.params === 'object' && !Array.isArray(program.params)
}

function freezeRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.freeze({ ...input })
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

  const exprValue = readExprValue(exprValues, program.activeWhenExprId)
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

function readExprValue(
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  exprIdOrSourceRef: string,
): CompiledRuntimeValue | undefined {
  if (Object.prototype.hasOwnProperty.call(exprValues, exprIdOrSourceRef)) {
    return exprValues[exprIdOrSourceRef]
  }

  const suffix = `_${exprIdOrSourceRef}`
  const matched = Object.entries(exprValues).filter(([key]) => key.endsWith(suffix))
  return matched.length === 1 ? matched[0]![1] : undefined
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

// ----------- dynamic_grid 分支（S5，7 路径） -----------
//
// 7 路径（plan v3 Acceptance Runtime）：
//   1) fail-closed: isValidDynamicGrid === false → cancelled + 占位 entry
//   2) K 线不足（bars < anchorLookbackBars）→ NOOP；prev 存在保留旧 ladder；无 prev → cancel
//   3) anchor 计算（bars.slice(-anchorLookbackBars) 取 high/low；mid = (high+low)/2）
//   4) anchor invalid（NaN/<=0）→ NOOP；prev 存在保留旧 ladder；无 prev → cancel
//   5) active 状态判断
//   6) inactive × onDeactivate 三模式（cancel/keep/close）
//   7) active + rebuild 决策（drift < threshold → keep prev；drift >= 但限速 → throttled；否则 rebuild）

interface DynamicGridRunArgs {
  ctx: StrategyExecutionContextV1
  program: CompiledDynamicGridProgram
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

function runDynamicGridProgram(args: DynamicGridRunArgs): void {
  const {
    ctx, program, exprValues, guardState, programLifecycleStateIn,
    orchWorkingOrders, orchActiveIds, orchCancelledIds, orchCloseIds,
    programLifecycleStateNext,
  } = args
  const prev = readPrevDynamicGridState(programLifecycleStateIn?.[program.id])

  // M4: cancelOrderPrograms guard pass-through dynamic_grid lifecycle
  if (guardState.cancelOrderPrograms) {
    orchCancelledIds.push(program.id)
    if (prev) {
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    // 无 prev → key 缺席（与 S0a substrate adapter map merge 视为 eviction）
    return
  }

  // 路径 1：fail-closed validator
  if (!isValidDynamicGrid(program)) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = freezeDynamicGridEntry({
      kind: 'dynamic_grid',
      lastBuildAnchor: 0,
      lastBuildAt: 0,
      lastBuildLadder: [],
    })
    return
  }

  const params = program.dynamicGridParams
  const bars = ctx.bars

  // 路径 2：K 线不足
  if (!bars || bars.length < params.anchorLookbackBars) {
    if (prev) {
      // 有 prev → 保留旧 ladder，不进 cancelled
      orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      orchActiveIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    else {
      // 无 prev → cancel，reason=insufficient_kline_window
      orchCancelledIds.push(program.id)
    }
    return
  }

  // 路径 3：anchor 计算
  const window = bars.slice(-params.anchorLookbackBars)
  let periodHigh = window[0].high
  let periodLow = window[0].low
  for (let i = 1; i < window.length; i++) {
    if (window[i].high > periodHigh) periodHigh = window[i].high
    if (window[i].low < periodLow) periodLow = window[i].low
  }
  let currentAnchor: number
  switch (params.anchorSide) {
    case 'high':
      currentAnchor = periodHigh
      break
    case 'low':
      currentAnchor = periodLow
      break
    case 'mid':
      // 锁公式：mid = (periodHigh + periodLow) / 2
      currentAnchor = (periodHigh + periodLow) / 2
      break
  }

  // 路径 4：anchor invalid
  if (!Number.isFinite(currentAnchor) || currentAnchor <= 0) {
    if (prev) {
      orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      orchActiveIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    else {
      orchCancelledIds.push(program.id)
    }
    return
  }

  // 路径 5：active 状态
  const isActive = exprValues[program.activeWhenExprId] === true

  // 路径 6：inactive 分支（onDeactivate 三模式）
  if (!isActive) {
    switch (program.onDeactivate) {
      case 'cancel':
        orchCancelledIds.push(program.id)
        if (prev) programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        break
      case 'keep':
        if (prev) {
          orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
          orchActiveIds.push(program.id)
          programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        }
        else {
          // 无 prev 且 inactive=keep → 无 ladder 可保留，进 cancel
          orchCancelledIds.push(program.id)
        }
        break
      case 'close':
        orchCloseIds.push(program.id)
        if (prev) programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        break
    }
    return
  }

  // 路径 7：active + rebuild 决策
  // now 来源确定性派生；禁止 Date.now() 回退
  const now = ctx.timestamp ?? bars[bars.length - 1].timestamp

  if (prev) {
    const driftPctActual = Math.abs(currentAnchor - prev.lastBuildAnchor) / prev.lastBuildAnchor * 100
    if (driftPctActual < params.anchorDriftPct) {
      // 不漂移：keep prev ladder + 透传 prev state
      orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      orchActiveIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
      return
    }
    // 漂移达标：再判限速
    if ((now - prev.lastBuildAt) / 1000 < params.rebuildMinIntervalSec) {
      // 限速 NOOP：保留旧 ladder + 透传 prev state，reason=rebuild_throttled
      orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      orchActiveIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
      return
    }
  }

  // rebuild：生成新 ladder
  const step = params.step.mode === 'pct'
    ? params.step.value / 100
    : params.step.value / currentAnchor
  const decay = 1 - step
  const newLevels: number[] = []
  for (let i = 0; i < params.levelCount; i++) {
    newLevels.push(round2(currentAnchor * decay ** (i + 1)))
  }

  orchWorkingOrders.push(buildDynamicGridWorkingOrder(program, newLevels))
  orchActiveIds.push(program.id)
  programLifecycleStateNext[program.id] = freezeDynamicGridEntry({
    kind: 'dynamic_grid',
    lastBuildAnchor: currentAnchor,
    lastBuildAt: now,
    lastBuildLadder: newLevels.map((level, i) => ({ id: `${program.id}:${i}`, level })),
  })
}

function isValidDynamicGrid(program: CompiledDynamicGridProgram): boolean {
  if (typeof program.activeWhenExprId !== 'string' || program.activeWhenExprId.length === 0) return false
  const params = program.dynamicGridParams
  if (!params) return false
  if (!Number.isInteger(params.anchorLookbackBars) || params.anchorLookbackBars < 10) return false
  if (params.anchorSide !== 'high' && params.anchorSide !== 'low' && params.anchorSide !== 'mid') return false
  if (!Number.isFinite(params.anchorDriftPct) || params.anchorDriftPct <= 0) return false
  if (!Number.isInteger(params.rebuildMinIntervalSec) || params.rebuildMinIntervalSec < 60) return false
  if (!params.step) return false
  if (params.step.mode !== 'pct' && params.step.mode !== 'absolute') return false
  if (!Number.isFinite(params.step.value) || params.step.value <= 0) return false
  if (!Number.isInteger(params.levelCount) || params.levelCount < 2) return false
  const { sizing } = program
  if (!sizing || !Number.isFinite(sizing.value) || sizing.value <= 0) return false
  return true
}

function buildDynamicGridWorkingOrder(
  program: CompiledDynamicGridProgram,
  levels: readonly number[],
): {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
} {
  return {
    id: program.id,
    sourceRef: 'orchestration:program.dynamic_grid',
    payload: {
      activeWhen: program.activeWhenExprId,
      dynamicGridParams: {
        ...program.dynamicGridParams,
        step: { ...program.dynamicGridParams.step },
      },
      sizing: { ...program.sizing },
    },
    levels: Object.freeze([...levels]),
  }
}

// 深 freeze 写入：entry 顶层 + lastBuildLadder 数组都需 frozen。
function freezeDynamicGridEntry(entry: {
  readonly kind: 'dynamic_grid'
  readonly lastBuildAnchor: number
  readonly lastBuildAt: number
  readonly lastBuildLadder: readonly { readonly id: string; readonly level: number }[]
}): ProgramLifecycleState {
  Object.freeze(entry.lastBuildLadder)
  return Object.freeze(entry)
}

function readPrevDynamicGridState(
  state: ProgramLifecycleState | undefined,
): Extract<ProgramLifecycleState, { kind: 'dynamic_grid' }> | null {
  if (!state || state.kind !== 'dynamic_grid') return null
  // 排除空 placeholder（fail-closed validator 写的 lastBuildAnchor=0 / ladder=[]）
  if (state.lastBuildAnchor <= 0 || state.lastBuildLadder.length === 0) return null
  return state
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

  // Path 1: fail-closed
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
    // Path B: 无 prev → cancelled + key 缺席（critic round 2 Major item 2）
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

  // 切分（critic round 2 Major item 1）：lower=floor(N/2), upper=N-lower
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

// ----------- event_listener 分支（Phase 5 S12, #1118） -----------
//
// 设计要点（plan A10 / Round 1 全部修复点）：
//   - 永不 push workingOrders；永不进 closeProgramIds（onDeactivate enum 已删 'close'，W5 守护）
//   - lifecycle state 按 program.id 索引（per-program 隔离 G1）
//   - dedup 半开区间 (now - dedupWindowMs, now]，严格 `>`；硬上限 1024 LRU（M2）
//   - dedup 命中事件不更新 lastEvent*（G3）
//   - 事件 payload canonicalSerialize 落 lastEventPayloadJson（G4）
//   - runtime 内 stable-sort by ts（G2）
//   - now = ctx.timestamp ?? bars[last].timestamp ?? 0；禁 Date.now()（C1）
//   - prev kind 不匹配走降级路径（视为初始 state）

const EVENT_LISTENER_PLACEHOLDER: ProgramLifecycleState = Object.freeze({
  kind: 'event_listener',
  lastEventAt: 0,
  lastEventId: null,
  lastEventPayloadJson: null,
  dedupBuffer: Object.freeze([]),
  schemaVersion: 0,
  escalateCount: 0,
})

interface EventListenerRunArgs {
  ctx: StrategyExecutionContextV1
  program: CompiledEventListenerProgram
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>
  guardState: Readonly<CompiledGuardState>
  programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>
  orchActiveIds: string[]
  orchCancelledIds: string[]
  programLifecycleStateNext: Record<string, ProgramLifecycleState>
}

function runEventListenerProgram(args: EventListenerRunArgs): void {
  const {
    ctx, program, exprValues, guardState, programLifecycleStateIn,
    orchActiveIds, orchCancelledIds, programLifecycleStateNext,
  } = args

  // 1) cancelOrderPrograms guard：进 cancelled + 占位 lifecycle
  if (guardState.cancelOrderPrograms) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = EVENT_LISTENER_PLACEHOLDER
    return
  }

  // 2) fail-closed validator
  if (!isValidEventListener(program)) {
    orchCancelledIds.push(program.id)
    programLifecycleStateNext[program.id] = EVENT_LISTENER_PLACEHOLDER
    return
  }

  // 3) prev lifecycle（kind 不匹配走降级 = 视为初始）
  const prevEntry = programLifecycleStateIn?.[program.id]
  const prev: Extract<ProgramLifecycleState, { kind: 'event_listener' }> | null =
    prevEntry && prevEntry.kind === 'event_listener' ? prevEntry : null

  // 4) activeWhen
  const isActive = exprValues[program.activeWhenExprId] === true

  // 5) inactive 路径
  if (!isActive) {
    if (program.onDeactivate === 'cancel') {
      // 清空 dedupBuffer，lastEvent 字段全清；保 schemaVersion / escalateCount 为占位
      orchCancelledIds.push(program.id)
      programLifecycleStateNext[program.id] = EVENT_LISTENER_PLACEHOLDER
      return
    }
    // onDeactivate === 'keep'：透传 prev（不读 ctx.eventInbox）
    orchActiveIds.push(program.id)
    programLifecycleStateNext[program.id] = prev ?? EVENT_LISTENER_PLACEHOLDER
    return
  }

  // 6) active 路径
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const lastBar = bars[bars.length - 1]
  const now = typeof ctx.timestamp === 'number' && Number.isFinite(ctx.timestamp)
    ? ctx.timestamp
    : (typeof lastBar?.timestamp === 'number' && Number.isFinite(lastBar.timestamp) ? lastBar.timestamp : 0)

  const inbox = ctx.eventInbox?.[program.sourceFeedId]
  const events = Array.isArray(inbox) ? [...inbox].sort((a, b) => a.ts - b.ts) : []

  // schemaVersion 检测（在事件遍历前）
  let schemaVersion = prev?.schemaVersion ?? 0
  const dedupCutoff = now - program.dedupWindowMs
  let dedupBuffer: Array<{ key: string; ts: number }> = prev
    ? prev.dedupBuffer.filter(entry => entry.ts > dedupCutoff).map(entry => ({ key: entry.key, ts: entry.ts }))
    : []

  if (program.rebuildPolicy === 'on_schema_version_bump') {
    const ctxVersion = ctx.eventSchemaVersion?.[program.sourceFeedId]
    if (typeof ctxVersion === 'number' && Number.isFinite(ctxVersion) && ctxVersion > schemaVersion) {
      // bump：清空过滤后的 buffer，更新 schemaVersion
      dedupBuffer = []
      schemaVersion = ctxVersion
    }
  }

  let lastEventAt = prev?.lastEventAt ?? 0
  let lastEventId = prev?.lastEventId ?? null
  let lastEventPayloadJson = prev?.lastEventPayloadJson ?? null
  let escalateCount = prev?.escalateCount ?? 0

  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    if (typeof event.ts !== 'number' || !Number.isFinite(event.ts)) continue
    if (typeof event.id !== 'string' || event.id.length === 0) continue
    const payload = event.payload
    if (!payload || typeof payload !== 'object') continue

    // 提取 idempotencyKey（fieldPath 0-1 层 `.`；readiness/runtime validator 已守门）
    const fieldPath = program.idempotencyKey.fieldPath
    const dotIndex = fieldPath.indexOf('.')
    let raw: unknown
    if (dotIndex === -1) {
      raw = (payload as Record<string, unknown>)[fieldPath]
    }
    else {
      const head = fieldPath.slice(0, dotIndex)
      const tail = fieldPath.slice(dotIndex + 1)
      const nested = (payload as Record<string, unknown>)[head]
      raw = nested && typeof nested === 'object'
        ? (nested as Record<string, unknown>)[tail]
        : undefined
    }
    if (typeof raw !== 'string' || raw.length === 0) {
      // 取值失败：fail 该事件 + 计入 escalate
      escalateCount += 1
      continue
    }
    const key = raw

    // 过期判定（先于 dedup）
    if (now - event.ts > program.expirationTtlMs) {
      if (program.expirationPolicy === 'escalate') {
        escalateCount += 1
      }
      continue
    }

    // dedup 判定：命中 → 跳过且不更新 lastEvent*
    if (dedupBuffer.some(entry => entry.key === key)) {
      continue
    }

    // 通过：更新 lastEvent + 写入 dedupBuffer
    lastEventAt = event.ts
    lastEventId = event.id
    lastEventPayloadJson = canonicalSerialize(payload)
    dedupBuffer.push({ key, ts: event.ts })
    // LRU 上限：超出按时间最早丢出（dedupBuffer 来自 prev 已 ts > cutoff，且按事件循环顺序追加，
    // 综合 stable-sort by ts 与 prev 顺序，从头丢即最早）
    if (dedupBuffer.length > EVENT_LISTENER_DEDUP_BUFFER_CAPACITY) {
      dedupBuffer = dedupBuffer.slice(dedupBuffer.length - EVENT_LISTENER_DEDUP_BUFFER_CAPACITY)
    }
  }

  orchActiveIds.push(program.id)
  // 深 freeze entry
  const frozenBuffer = Object.freeze(dedupBuffer.map(entry => Object.freeze({ key: entry.key, ts: entry.ts })))
  programLifecycleStateNext[program.id] = Object.freeze({
    kind: 'event_listener' as const,
    lastEventAt,
    lastEventId,
    lastEventPayloadJson,
    dedupBuffer: frozenBuffer,
    schemaVersion,
    escalateCount,
  })

}
