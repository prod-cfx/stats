import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledOrchestrationProgram } from './compiled-orchestration-program'
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
  // S5/S6 引入复杂 entry 时升级为深 freeze。
  programLifecycleStateNext: Readonly<Record<string, ProgramLifecycleState>>
}

export function runOrderPrograms(
  // ctx 当前只用于 S5/S6 经 ctx.bars 读 K 线窗口；S0a path 不消费。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: StrategyExecutionContextV1,
  programs: readonly OrderProgramNode[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  orderProgramOrder: readonly string[],
  _executionModel?: Record<string, unknown>,
  orchestrationPrograms?: readonly CompiledOrchestrationProgram[],
  // Phase 5 S0a: 第 8 参 — 上一根 K 线产出的 lifecycle 状态（按 program.id 索引）。
  // S0a fixed_grid_gated 不消费此参数（保 0 回归）；S5/S6 dynamic_grid / adaptive_volatility_grid 消费。
  // K 线窗口由 ctx.bars 暴露（StrategyExecutionContextV1.bars，runner populate）。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _programLifecycleStateIn?: Readonly<Record<string, ProgramLifecycleState>>,
): Readonly<CompiledOrderState> {
  // ---------- Orchestration program lifecycle (Phase 5 S4 T11) ----------
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
      if (guardState.cancelOrderPrograms) {
        orchCancelledIds.push(program.id)
        // S0a: fixed_grid_gated 仍写 placeholder（lifecycle 持续，由 close/cleanup 负责清除）
        if (program.programKind === 'fixed_grid_gated') {
          programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }
        }
        continue
      }

      // fail-closed: invalid activeWhenExprId / sizing / gridParams → cancel
      if (!isValidOrchestrationProgram(program)) {
        orchCancelledIds.push(program.id)
        continue
      }

      const exprValue = exprValues[program.activeWhenExprId]
      const isActive = exprValue === true

      // S0a: fixed_grid_gated 占位 placeholder（active / inactive / close 各分支均写）
      if (program.programKind === 'fixed_grid_gated') {
        programLifecycleStateNext[program.id] = { kind: 'fixed_grid_gated' }
      }

      if (isActive) {
        orchActiveIds.push(program.id)
        orchWorkingOrders.push(buildOrchestrationWorkingOrder(program))
        continue
      }

      // inactive: dispatch by onDeactivate
      switch (program.onDeactivate) {
        case 'cancel':
          orchCancelledIds.push(program.id)
          break
        case 'keep':
          orchWorkingOrders.push(buildOrchestrationWorkingOrder(program))
          break
        case 'close':
          orchCloseIds.push(program.id)
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
    // S0a: 顶层 freeze 即可（fixed_grid_gated entry 无嵌套结构）；S5/S6 引入复杂 entry 时升级为深 freeze。
    programLifecycleStateNext: Object.freeze(programLifecycleStateNext),
  })
}

function isValidOrchestrationProgram(program: CompiledOrchestrationProgram): boolean {
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
 * Build orchestration program working order.
 *
 * Levels formula (MVP, fixed_grid_gated):
 *   levels[i] = anchorPrice * (1 - stepPct/100)^(i+1)   for i = 0..levelCount-1
 * 即"等比向下挂买单"，与 anchorPrice=50000/stepPct=5/levelCount=3 →
 *   [47500, 45125, 42868.75] 一致。
 *
 * 若设置 lowerBound：levels 不下穿（< lowerBound 的 level 被裁剪掉）。
 * 若设置 upperBound：levels 不上穿（> upperBound 的 level 被裁剪掉）。
 * 数值四舍五入到 2 位小数（与 fixture 对齐）。
 */
function buildOrchestrationWorkingOrder(program: CompiledOrchestrationProgram): {
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
