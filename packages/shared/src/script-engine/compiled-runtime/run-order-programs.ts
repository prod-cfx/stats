import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type {
  CompiledDynamicGridProgram,
  CompiledFixedGridGatedProgram,
  CompiledOrchestrationProgram,
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
  // Phase 5 S0a: program lifecycle 跨 K 线状态通道；S0a 仅 fixed_grid_gated 占位 noop。
  // Phase 5 S5：dynamic_grid 写入 lastBuildAnchor / lastBuildAt / lastBuildLadder（深 freeze）。
  programLifecycleStateNext: Readonly<Record<string, ProgramLifecycleState>>
}

export function runOrderPrograms(
  ctx: StrategyExecutionContextV1,
  programs: readonly OrderProgramNode[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  orderProgramOrder: readonly string[],
  _executionModel?: Record<string, unknown>,
  orchestrationPrograms?: readonly CompiledOrchestrationProgram[],
  // Phase 5 S0a: 第 8 参 — 上一根 K 线产出的 lifecycle 状态（按 program.id 索引）。
  // S0a fixed_grid_gated 只写 placeholder；S5 dynamic_grid 消费 prev anchor / lastBuildAt / lastBuildLadder
  // 用于 throttle / drift 判定。K 线窗口由 ctx.bars 暴露（StrategyExecutionContextV1.bars）。
  programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>,
): Readonly<CompiledOrderState> {
  // ---------- Orchestration program lifecycle (Phase 5 S4 T11 + S5) ----------
  const orchWorkingOrders: Array<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
  }> = []
  const orchActiveIds: string[] = []
  const orchCancelledIds: string[] = []
  const orchCloseIds: string[] = []
  // 跨 K 线 lifecycle 状态出向通道（按 program.id 索引）；S5 复杂 entry 在写入处深 freeze。
  const programLifecycleStateNext: Record<string, ProgramLifecycleState> = {}

  if (orchestrationPrograms && orchestrationPrograms.length > 0) {
    for (const program of orchestrationPrograms) {
      // 主循环入口必须按 programKind 路由（critic round 2 C1）：
      // 严禁在 switch 之前 destructure gridParams / dynamicGridParams 或写 sourceRef
      switch (program.programKind) {
        case 'fixed_grid_gated':
          handleFixedGridGated(program, exprValues, guardState, orchWorkingOrders, orchActiveIds, orchCancelledIds, orchCloseIds, programLifecycleStateNext)
          break
        case 'dynamic_grid':
          handleDynamicGrid(
            program,
            ctx,
            exprValues,
            guardState,
            orchWorkingOrders,
            orchActiveIds,
            orchCancelledIds,
            orchCloseIds,
            programLifecycleStateIn,
            programLifecycleStateNext,
          )
          break
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
    // S5：复杂 entry 在写入处已深 freeze；此处仅顶层 freeze map 自身即可。
    programLifecycleStateNext: Object.freeze(programLifecycleStateNext),
  })
}

// ============================================================================
// fixed_grid_gated 分支（Phase 5 S4，本次仅 rename，行为 0 回归）
// ============================================================================

function handleFixedGridGated(
  program: CompiledFixedGridGatedProgram,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  workingOrders: Array<{ id: string; sourceRef: string; payload?: Record<string, unknown>; levels?: readonly number[] }>,
  activeIds: string[],
  cancelledIds: string[],
  closeIds: string[],
  programLifecycleStateNext: Record<string, ProgramLifecycleState>,
): void {
  if (guardState.cancelOrderPrograms) {
    cancelledIds.push(program.id)
    // S0a: fixed_grid_gated 仍写 placeholder（lifecycle 持续，由 close/cleanup 负责清除）
    programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }
    return
  }

  // fail-closed: invalid activeWhenExprId / sizing / gridParams → cancel
  if (!isValidFixedGridGated(program)) {
    cancelledIds.push(program.id)
    return
  }

  const exprValue = exprValues[program.activeWhenExprId]
  const isActive = exprValue === true

  // S0a: fixed_grid_gated 占位 placeholder（active / inactive / close 各分支均写）
  programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }

  if (isActive) {
    activeIds.push(program.id)
    workingOrders.push(buildFixedGridGatedWorkingOrder(program))
    return
  }

  // inactive: dispatch by onDeactivate
  switch (program.onDeactivate) {
    case 'cancel':
      cancelledIds.push(program.id)
      break
    case 'keep':
      workingOrders.push(buildFixedGridGatedWorkingOrder(program))
      break
    case 'close':
      closeIds.push(program.id)
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

/**
 * Build fixed_grid_gated working order.
 *
 * Levels formula (MVP):
 *   levels[i] = anchorPrice * (1 - stepPct/100)^(i+1)   for i = 0..levelCount-1
 * 即"等比向下挂买单"，与 anchorPrice=50000/stepPct=5/levelCount=3 →
 *   [47500, 45125, 42868.75] 一致。
 */
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

// ============================================================================
// dynamic_grid 分支（Phase 5 S5）
// ============================================================================

function handleDynamicGrid(
  program: CompiledDynamicGridProgram,
  ctx: StrategyExecutionContextV1,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  workingOrders: Array<{ id: string; sourceRef: string; payload?: Record<string, unknown>; levels?: readonly number[] }>,
  activeIds: string[],
  cancelledIds: string[],
  closeIds: string[],
  programLifecycleStateIn: Readonly<Record<string, ProgramLifecycleState>> | undefined,
  programLifecycleStateNext: Record<string, ProgramLifecycleState>,
): void {
  const prev = readPrevDynamicGridState(programLifecycleStateIn?.[program.id])

  // critic round 2 M4: cancelOrderPrograms guard 必须 pass-through dynamic_grid lifecycle
  if (guardState.cancelOrderPrograms) {
    cancelledIds.push(program.id)
    if (prev) {
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    return
  }

  // 路径 1：fail-closed validator
  if (!isValidDynamicGrid(program)) {
    cancelledIds.push(program.id)
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
      workingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      activeIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    else {
      // 无 prev → cancel，reason=insufficient_kline_window
      cancelledIds.push(program.id)
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
      // 锁公式（critic round 1 M4）：mid = (periodHigh + periodLow) / 2
      currentAnchor = (periodHigh + periodLow) / 2
      break
  }

  // 路径 4：anchor invalid
  if (!Number.isFinite(currentAnchor) || currentAnchor <= 0) {
    if (prev) {
      workingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      activeIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
    }
    else {
      cancelledIds.push(program.id)
    }
    return
  }

  // 路径 5：active 状态
  const isActive = exprValues[program.activeWhenExprId] === true

  // 路径 6：inactive 分支（onDeactivate 三模式）
  if (!isActive) {
    switch (program.onDeactivate) {
      case 'cancel':
        cancelledIds.push(program.id)
        if (prev) programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        break
      case 'keep':
        if (prev) {
          workingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
          activeIds.push(program.id)
          programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        }
        else {
          // 无 prev 且 inactive=keep → 无 ladder 可保留，进 cancel
          cancelledIds.push(program.id)
        }
        break
      case 'close':
        closeIds.push(program.id)
        if (prev) programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
        break
    }
    return
  }

  // 路径 7：active + rebuild 决策
  // critic round 2 M3：now 来源确定性派生；禁止 Date.now() 回退
  const now = ctx.timestamp ?? bars[bars.length - 1].timestamp

  if (prev) {
    const driftPctActual = Math.abs(currentAnchor - prev.lastBuildAnchor) / prev.lastBuildAnchor * 100
    if (driftPctActual < params.anchorDriftPct) {
      // 不漂移：keep prev ladder + 透传 prev state
      workingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      activeIds.push(program.id)
      programLifecycleStateNext[program.id] = freezeDynamicGridEntry(prev)
      return
    }
    // 漂移达标：再判限速
    if ((now - prev.lastBuildAt) / 1000 < params.rebuildMinIntervalSec) {
      // 限速 NOOP：保留旧 ladder + 透传 prev state，reason=rebuild_throttled
      workingOrders.push(buildDynamicGridWorkingOrder(program, prev.lastBuildLadder.map(entry => entry.level)))
      activeIds.push(program.id)
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

  workingOrders.push(buildDynamicGridWorkingOrder(program, newLevels))
  activeIds.push(program.id)
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

// 深 freeze 写入（critic round 2 M1）：entry 顶层 + lastBuildLadder 数组都需 frozen。
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
