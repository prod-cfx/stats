import { Injectable } from '@nestjs/common'

import {
  CURRENT_SEMANTIC_VERSION,
  isAtomExecutableForStrategy,
} from '../nl-gateway/version-gate/version-gate'
import type { StrategyVersionInfo } from '../nl-gateway/version-gate/version-gate.types'
import type {
  SemanticOrchestrationContract,
  SemanticOrchestrationNode,
  SemanticSlotState,
} from '../types/semantic-state'

export interface SemanticOrchestrationValidationResult {
  ok: boolean
  missingSlots: SemanticSlotState[]
}

const GATE_REGIME_KEY = 'gate.regime'
const PORTFOLIO_DRAWDOWN_BLOCK_KEY = 'portfolioRisk.drawdown_block'
const PROGRAM_FIXED_GRID_GATED_KEY = 'program.fixed_grid_gated'
const PROGRAM_DYNAMIC_GRID_KEY = 'program.dynamic_grid'

const PROGRAM_FIXED_GRID_GATED_CONTRACT: SemanticOrchestrationContract = {
  id: 'program.fixed_grid_gated',
  kind: 'program',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'manage',
      object: 'limit_ladder',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'provide',
      object: 'limit_order',
    },
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_equity',
    },
  ],
  stateRequirements: [
    {
      domain: 'state',
      verb: 'read_write',
      object: 'program_lifecycle',
    },
  ],
  orderRequirements: [
    {
      domain: 'order',
      verb: 'support',
      object: 'limit_order',
    },
    {
      domain: 'order',
      verb: 'cancel',
      object: 'limit_order',
    },
  ],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'manage',
      object: 'limit_ladder',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

const PROGRAM_DYNAMIC_GRID_CONTRACT: SemanticOrchestrationContract = {
  id: 'program.dynamic_grid',
  kind: 'program',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'manage',
      object: 'dynamic_grid_ladder',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'provide',
      object: 'limit_order',
    },
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_equity',
    },
    {
      domain: 'runtime',
      verb: 'provide',
      object: 'bar_ohlcv',
    },
  ],
  stateRequirements: [
    {
      domain: 'state',
      verb: 'read_write',
      object: 'program_lifecycle',
    },
  ],
  orderRequirements: [
    {
      domain: 'order',
      verb: 'support',
      object: 'limit_order',
    },
    {
      domain: 'order',
      verb: 'cancel',
      object: 'limit_order',
    },
  ],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'manage',
      object: 'limit_ladder',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

const PORTFOLIO_DRAWDOWN_BLOCK_CONTRACT: SemanticOrchestrationContract = {
  id: 'portfolioRisk.drawdown_block',
  kind: 'portfolioRisk',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'portfolio_risk',
      object: 'drawdown_block',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_drawdown_pct',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'block',
      object: 'new_entries',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

const GATE_REGIME_CONTRACT: SemanticOrchestrationContract = {
  id: 'gate.regime',
  kind: 'gate',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'gate',
      object: 'entry_phase',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'provide',
      object: 'compiled_predicate_runtime',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'block',
      object: 'new_entries',
    },
  ],
  target: { phase: 'entry' },
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

@Injectable()
export class SemanticOrchestrationRegistryService {
  private readonly contracts: ReadonlyMap<string, SemanticOrchestrationContract> = new Map([
    [GATE_REGIME_KEY, GATE_REGIME_CONTRACT],
    [PORTFOLIO_DRAWDOWN_BLOCK_KEY, PORTFOLIO_DRAWDOWN_BLOCK_CONTRACT],
    [PROGRAM_FIXED_GRID_GATED_KEY, PROGRAM_FIXED_GRID_GATED_CONTRACT],
    [PROGRAM_DYNAMIC_GRID_KEY, PROGRAM_DYNAMIC_GRID_CONTRACT],
  ])

  getContractByKey(key: string): SemanticOrchestrationContract | null {
    return this.contracts.get(key) ?? null
  }

  validate(node: SemanticOrchestrationNode): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    if (node.kind === 'program') {
      return this.validateProgramNode(node)
    }
    if (node.kind === 'portfolioRisk' && node.key === PORTFOLIO_DRAWDOWN_BLOCK_KEY) {
      const thresholdPct = node.thresholdPct
      const thresholdInvalid =
        thresholdPct === undefined ||
        typeof thresholdPct !== 'number' ||
        Number.isNaN(thresholdPct) ||
        thresholdPct <= 0 ||
        thresholdPct > 100
      const modeInvalid = node.mode !== 'observe' && node.mode !== 'enforce'
      const scopeInvalid = node.scope !== 'portfolio'
      if (thresholdInvalid || modeInvalid || scopeInvalid) {
        missingSlots.push({
          slotKey: 'orchestration.portfolio_drawdown.threshold_pct',
          fieldPath: `orchestration.portfolioRisk.drawdown_block[${node.id}]`,
          status: 'open',
          priority: 'core',
          questionHint: '请确认账户回撤百分比阈值（0..100）',
          affectsExecution: true,
        })
      }
      return { ok: missingSlots.length === 0, missingSlots }
    }
    if (node.activeWhen === undefined) {
      missingSlots.push({
        slotKey: 'orchestration.gate.regime.active_when',
        fieldPath: `orchestration.gate.regime[${node.id}]`,
        status: 'open',
        priority: 'core',
        questionHint: '请确认趋势过滤的指标与周期',
        affectsExecution: true,
      })
    }
    return { ok: missingSlots.length === 0, missingSlots }
  }

  private validateProgramNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
    if (node.key === PROGRAM_DYNAMIC_GRID_KEY) {
      return this.validateDynamicGridProgramNode(node)
    }

    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.program.fixed_grid_gated[${node.id}]`
    const pushSlot = (field: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.program.fixed_grid_gated.${field}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.key !== PROGRAM_FIXED_GRID_GATED_KEY) {
      pushSlot('program_kind', '请确认 program 节点的 key（仅支持 program.fixed_grid_gated / program.dynamic_grid）')
      return { ok: false, missingSlots }
    }

    if (node.programKind !== 'fixed_grid_gated') {
      pushSlot('program_kind', '请确认 programKind 为 fixed_grid_gated')
    }

    const onDeactivate = node.onDeactivate
    if (onDeactivate !== 'cancel' && onDeactivate !== 'keep' && onDeactivate !== 'close') {
      pushSlot('on_deactivate', '请确认停用时行为（cancel/keep/close）')
    }

    if (node.rebuildPolicy !== 'static') {
      pushSlot('rebuild_policy', '请确认重建策略（仅支持 static）')
    }

    const grid = node.gridParams
    const isPositiveFinite = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0

    if (!grid || !isPositiveFinite(grid.anchorPrice)) {
      pushSlot('grid_params.anchor_price', '请确认网格锚定价格（>0 有限数）')
    }

    if (
      !grid
      || typeof grid.levelCount !== 'number'
      || !Number.isFinite(grid.levelCount)
      || !Number.isInteger(grid.levelCount)
      || grid.levelCount < 2
      || grid.levelCount > 100
    ) {
      pushSlot('grid_params.level_count', '请确认网格档位数量（2..100 整数）')
    }

    if (
      !grid
      || typeof grid.stepPct !== 'number'
      || !Number.isFinite(grid.stepPct)
      || grid.stepPct <= 0
      || grid.stepPct > 100
    ) {
      pushSlot('grid_params.step_pct', '请确认网格步长百分比（0..100）')
    }

    if (grid && grid.lowerBound !== undefined) {
      if (!isPositiveFinite(grid.lowerBound)) {
        pushSlot('grid_params.lower_bound', '请确认网格下界（>0 有限数）')
      } else if (grid.upperBound !== undefined && isPositiveFinite(grid.upperBound) && grid.lowerBound >= grid.upperBound) {
        pushSlot('grid_params.lower_bound', '请确认网格下界必须小于上界')
      }
    }

    if (grid && grid.upperBound !== undefined && !isPositiveFinite(grid.upperBound)) {
      pushSlot('grid_params.upper_bound', '请确认网格上界（>0 有限数）')
    }

    const sizing = node.sizing
    if (
      !sizing
      || (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct')
    ) {
      pushSlot('sizing.mode', '请确认仓位模式（fixed_quote/fixed_base/fixed_pct）')
    }

    if (!sizing || !isPositiveFinite(sizing.value)) {
      pushSlot('sizing.value', '请确认仓位数值（>0 有限数）')
    }

    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') {
      pushSlot('active_when_ref', '请确认 active_when_ref 引用的 gate 节点 id')
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  private validateDynamicGridProgramNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.program.dynamic_grid[${node.id}]`
    const pushSlot = (field: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.program.dynamic_grid.${field}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    const isPositiveFinite = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0

    if (node.programKind !== 'dynamic_grid') {
      pushSlot('program_kind', '请确认 programKind 为 dynamic_grid')
    }

    const onDeactivate = node.onDeactivate
    if (onDeactivate !== 'cancel' && onDeactivate !== 'keep' && onDeactivate !== 'close') {
      pushSlot('on_deactivate', '请确认停用时行为（cancel/keep/close）')
    }

    if (node.rebuildPolicy !== 'anchor_on_state_change') {
      pushSlot('rebuild_policy', '请确认重建策略（仅支持 anchor_on_state_change）')
    }

    const lookback = node.anchorLookbackBars
    if (
      typeof lookback !== 'number'
      || !Number.isFinite(lookback)
      || !Number.isInteger(lookback)
      || lookback < 10
      || lookback > 1000
    ) {
      pushSlot('anchor_lookback_bars', '请确认 anchor lookback K 线根数（10..1000 整数）')
    }

    const anchorSide = node.anchorSide
    if (anchorSide !== 'high' && anchorSide !== 'low' && anchorSide !== 'mid') {
      pushSlot('anchor_side', '请确认 anchor 取值方向（high/low/mid）')
    }

    const driftPct = node.anchorDriftPct
    if (driftPct === undefined || !isPositiveFinite(driftPct) || driftPct > 100) {
      pushSlot('anchor_drift_pct', '请确认 anchor 漂移阈值（0..100 有限正数）')
    }

    const minInterval = node.rebuildMinIntervalSec
    if (
      typeof minInterval !== 'number'
      || !Number.isFinite(minInterval)
      || !Number.isInteger(minInterval)
      || minInterval < 60
    ) {
      pushSlot('rebuild_min_interval_sec', '请确认 rebuild 最小间隔（≥60 秒整数）')
    }

    const step = node.dynamicGridStep
    if (!step || (step.mode !== 'pct' && step.mode !== 'absolute')) {
      pushSlot('dynamic_grid_step.mode', '请确认网格步长模式（pct/absolute）')
    }
    if (!step || !isPositiveFinite(step.value)) {
      pushSlot('dynamic_grid_step.value', '请确认网格步长数值（>0 有限数）')
    }

    const levelCount = node.levelCount
    if (
      typeof levelCount !== 'number'
      || !Number.isFinite(levelCount)
      || !Number.isInteger(levelCount)
      || levelCount < 2
      || levelCount > 100
    ) {
      pushSlot('level_count', '请确认网格档位数量（2..100 整数）')
    }

    const sizing = node.sizing
    if (
      !sizing
      || (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct')
    ) {
      pushSlot('sizing.mode', '请确认仓位模式（fixed_quote/fixed_base/fixed_pct）')
    }
    if (!sizing || !isPositiveFinite(sizing.value)) {
      pushSlot('sizing.value', '请确认仓位数值（>0 有限数）')
    }

    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') {
      pushSlot('active_when_ref', '请确认 active_when_ref 引用的 gate 节点 id')
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  isExecutableForStrategy(
    contract: SemanticOrchestrationContract,
    strategy: StrategyVersionInfo,
  ): boolean {
    return isAtomExecutableForStrategy(contract, strategy)
  }
}
