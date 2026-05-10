import { Injectable } from '@nestjs/common'

import { parseTimeframeMs } from '@ai/shared/script-engine/compiled-runtime'
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
// Phase 5 S8 (#1119)
const PORTFOLIO_SYMBOL_EXPOSURE_CAP_KEY = 'portfolioRisk.symbol_exposure_cap'
const PORTFOLIO_SUBSTRATEGY_EXPOSURE_CAP_KEY = 'portfolioRisk.substrategy_exposure_cap'
const PROGRAM_FIXED_GRID_GATED_KEY = 'program.fixed_grid_gated'
const PROGRAM_DYNAMIC_GRID_KEY = 'program.dynamic_grid'
const PROGRAM_ADAPTIVE_VOLATILITY_GRID_KEY = 'program.adaptive_volatility_grid'
// Phase 5 S12 (#1118): event_listener
const PROGRAM_EVENT_LISTENER_KEY = 'program.event_listener'
const EVENT_LISTENER_PERMISSION_SCOPE_PATTERN = /^[a-z][a-z0-9_:]{2,63}$/u
const EVENT_LISTENER_FIELD_PATH_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}(\.[a-zA-Z][a-zA-Z0-9_]{0,63})?$/u
const EVENT_LISTENER_DEDUP_WINDOW_MIN_MS = 100
const EVENT_LISTENER_DEDUP_WINDOW_MAX_MS = 3_600_000
const EVENT_LISTENER_EXPIRATION_TTL_MIN_MS = 100
const EVENT_LISTENER_EXPIRATION_TTL_MAX_MS = 86_400_000
const SCOPE_SYMBOL_KEY = 'scope.symbol'
const SCOPE_LEG_KEY = 'scope.leg'
// Phase 5 S3 (#1109)
const SCOPE_TIMEFRAME_KEY = 'scope.timeframe'
const TIMEFRAME_REQUIRED_MIN_LENGTH = 1
const TIMEFRAME_REQUIRED_MAX_LENGTH = 8
// Phase 5 S9 (#1110)
const SCOPE_DATA_SOURCE_KEY = 'scope.dataSource'
// Phase 5 S10 (#1111)
const SCOPE_SUBSTRATEGY_KEY = 'scope.subStrategy'

const SYMBOL_FORMAT_PATTERN = /^[A-Z]{2,5}USDT$/u
const SYMBOL_MAX_LENGTH = 32
const SUBSTRATEGY_ID_MAX_LENGTH = 64

// Phase 5 S11 (#1112): legId 与 node.id 是两个独立标识；legId 仅在 leg 节点子集内唯一并供 pairedLegId 引用
const LEG_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]{0,63}$/u
// Phase 5 S3 (#1109): scope.timeframe contract
//   capability: orchestration declare timeframe_scope
//   runtimeRequirements: read.bar_status_by_timeframe (caller 注入 ctx.timeframeBarStatus)
//   effects: orchestration bind timeframe_scope（owner 节点 timeframeScopeRef 透传）
const SCOPE_TIMEFRAME_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.timeframe',
  kind: 'scope',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'declare',
      object: 'timeframe_scope',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'read',
      object: 'bar_status_by_timeframe',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'orchestration',
      verb: 'bind',
      object: 'timeframe_scope',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

// Phase 5 S9 (#1110): scope.dataSource 校验常量
const FEED_ID_FORMAT_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/u  // 总长 1..64
const DATA_SOURCE_ROLES = new Set(['primary', 'confirmation', 'event'])
const DATA_SOURCE_SCHEMAS = new Set(['ohlcv', 'orderbook', 'liquidation', 'webhook_event'])

// Phase 5 S9 (#1110): scope.dataSource contract
const SCOPE_DATA_SOURCE_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.dataSource',
  kind: 'scope',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'declare',
      object: 'data_source_scope',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'route',
      object: 'data_source_feed',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'orchestration',
      verb: 'bind',
      object: 'data_source_scope',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

const SCOPE_SYMBOL_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.symbol',
  kind: 'scope',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'declare',
      object: 'symbol_scope',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'route',
      object: 'symbol_scope_decision',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'orchestration',
      verb: 'bind',
      object: 'symbol_scope',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

// Phase 5 S11 (#1112): scope.leg contract — 6 字段齐全
const SCOPE_LEG_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.leg',
  kind: 'scope',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'declare',
      object: 'leg_scope',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'route',
      object: 'leg_scope_decision',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'orchestration',
      verb: 'bind',
      object: 'leg_scope',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

// Phase 5 S10 (#1111): scope.subStrategy substrate contract
//   capability: orchestration declare sub_strategy_scope
//   runtimeRequirements: runtime route sub_strategy_scope_decision（与 S2 同形态，新 vocab 不入 substrate 白名单）
//   stateRequirements: 留空（caller 在 ctx 注入 activeSubStrategyScopeId；cross-bar memory 由 follow-up #1113 承担）
//   effects: declare → bind 子策略 scope；guard pause sub_strategy；orchestration switch sub_strategy
const SCOPE_SUBSTRATEGY_CONTRACT: SemanticOrchestrationContract = {
  id: 'scope.subStrategy',
  kind: 'scope',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'declare',
      object: 'sub_strategy_scope',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'route',
      object: 'sub_strategy_scope_decision',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'orchestration',
      verb: 'bind',
      object: 'sub_strategy_scope',
    },
    {
      domain: 'guard',
      verb: 'pause',
      object: 'sub_strategy',
    },
    {
      domain: 'orchestration',
      verb: 'switch',
      object: 'sub_strategy',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

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

// Phase 5 S5 (#984): dynamic_grid contract
//   capability: orchestration manage dynamic_grid_ladder
//   runtimeRequirements: limit_order + account.equity + bar_ohlcv (S0a vocab)
//   stateRequirements: program_lifecycle (S0a vocab)
//   orderRequirements: limit_order support + cancel
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

// Phase 5 S6 (#984): adaptive_volatility_grid contract
//   capability: orchestration manage adaptive_volatility_grid_ladder
//   runtimeRequirements: limit_order + account.equity + bar_ohlcv (S0a vocab)
//   stateRequirements: program_lifecycle (S0a vocab)
//   orderRequirements: limit_order support + cancel
const PROGRAM_ADAPTIVE_VOLATILITY_GRID_CONTRACT: SemanticOrchestrationContract = {
  id: 'program.adaptive_volatility_grid',
  kind: 'program',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'manage',
      object: 'adaptive_volatility_grid_ladder',
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

// Phase 5 S12 (#1118): event_listener contract
//   capability: orchestration ingest external_event
//   runtimeRequirements: subscribe/event_source + read/event_inbox（S12 首次引入 vocab；
//     形式化收口由 future vocabulary registry follow-up issue 接管）
//   stateRequirements: read_write/program_lifecycle（与 S5/S6 同模式）
//   orderRequirements: 无（关键差异 — 不发限价单）
const PROGRAM_EVENT_LISTENER_CONTRACT: SemanticOrchestrationContract = {
  id: 'program.event_listener',
  kind: 'program',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'ingest',
      object: 'external_event',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'subscribe',
      object: 'event_source',
    },
    {
      domain: 'runtime',
      verb: 'read',
      object: 'event_inbox',
    },
  ],
  stateRequirements: [
    {
      domain: 'state',
      verb: 'read_write',
      object: 'program_lifecycle',
    },
  ],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'data',
      verb: 'ingest',
      object: 'external_event',
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

// Phase 5 S8 (#1119): portfolioRisk.symbol_exposure_cap contract
//   capability: orchestration portfolio_risk symbol_exposure_cap
//   runtimeRequirements: read.exposure_notional_by_symbol_scope + read.account_equity
//   effects: guard block new_entries OR guard reduce exposure
const PORTFOLIO_SYMBOL_EXPOSURE_CAP_CONTRACT: SemanticOrchestrationContract = {
  id: 'portfolioRisk.symbol_exposure_cap',
  kind: 'portfolioRisk',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'portfolio_risk',
      object: 'symbol_exposure_cap',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'read',
      object: 'exposure_notional_by_symbol_scope',
    },
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_equity',
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

// Phase 5 S8 (#1119): portfolioRisk.substrategy_exposure_cap contract
//   capability: orchestration portfolio_risk substrategy_exposure_cap
//   runtimeRequirements: read.exposure_notional_by_substrategy_scope + read.account_equity
//   effects: guard pause sub_strategy OR guard block new_entries
const PORTFOLIO_SUBSTRATEGY_EXPOSURE_CAP_CONTRACT: SemanticOrchestrationContract = {
  id: 'portfolioRisk.substrategy_exposure_cap',
  kind: 'portfolioRisk',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'portfolio_risk',
      object: 'substrategy_exposure_cap',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'read',
      object: 'exposure_notional_by_substrategy_scope',
    },
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_equity',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'pause',
      object: 'sub_strategy',
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
    // Phase 5 S8 (#1119)
    [PORTFOLIO_SYMBOL_EXPOSURE_CAP_KEY, PORTFOLIO_SYMBOL_EXPOSURE_CAP_CONTRACT],
    [PORTFOLIO_SUBSTRATEGY_EXPOSURE_CAP_KEY, PORTFOLIO_SUBSTRATEGY_EXPOSURE_CAP_CONTRACT],
    [PROGRAM_FIXED_GRID_GATED_KEY, PROGRAM_FIXED_GRID_GATED_CONTRACT],
    [PROGRAM_DYNAMIC_GRID_KEY, PROGRAM_DYNAMIC_GRID_CONTRACT],
    [PROGRAM_ADAPTIVE_VOLATILITY_GRID_KEY, PROGRAM_ADAPTIVE_VOLATILITY_GRID_CONTRACT],
    [PROGRAM_EVENT_LISTENER_KEY, PROGRAM_EVENT_LISTENER_CONTRACT],
    [SCOPE_SYMBOL_KEY, SCOPE_SYMBOL_CONTRACT],
    [SCOPE_LEG_KEY, SCOPE_LEG_CONTRACT],
    [SCOPE_TIMEFRAME_KEY, SCOPE_TIMEFRAME_CONTRACT],
    [SCOPE_DATA_SOURCE_KEY, SCOPE_DATA_SOURCE_CONTRACT],
    // Phase 5 S10 (#1111)
    [SCOPE_SUBSTRATEGY_KEY, SCOPE_SUBSTRATEGY_CONTRACT],
  ])

  getContractByKey(key: string): SemanticOrchestrationContract | null {
    return this.contracts.get(key) ?? null
  }

  validate(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[] = [],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    if (node.kind === 'program') {
      return this.validateProgramNode(node, siblingNodes)
    }
    if (node.kind === 'scope') {
      // Phase 5 S11 (#1112): scope kind 路由到 symbol vs leg 子类型
      if (node.key === SCOPE_LEG_KEY || node.legScopeKind === 'leg') {
        return this.validateLegScopeNode(node, siblingNodes)
      }
      // Phase 5 S9 (#1110): scope.dataSource
      if (node.key === SCOPE_DATA_SOURCE_KEY) {
        return this.validateDataSourceScopeNode(node, siblingNodes)
      }
      // Phase 5 S3 (#1109): scope.timeframe
      if (node.key === SCOPE_TIMEFRAME_KEY) {
        return this.validateTimeframeScopeNode(node, siblingNodes)
      }
      // Phase 5 S2 (#1104): scope.symbol（默认 / 兜底 unsupported_kind 由 validateSymbolScopeNode 内部产出）
      return this.validateSymbolScopeNode(node, siblingNodes)
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
    // Phase 5 S8 (#1119): portfolioRisk.symbol_exposure_cap
    if (node.kind === 'portfolioRisk' && node.key === PORTFOLIO_SYMBOL_EXPOSURE_CAP_KEY) {
      return this.validateSymbolExposureCapNode(node)
    }
    // Phase 5 S8 (#1119): portfolioRisk.substrategy_exposure_cap
    if (node.kind === 'portfolioRisk' && node.key === PORTFOLIO_SUBSTRATEGY_EXPOSURE_CAP_KEY) {
      return this.validateSubStrategyExposureCapNode(node)
    }
    // Phase 5 S10 (#1111): gate 节点 phase=subStrategy 形状校验
    //   - target.phase='subStrategy' 必须与 effect ∈ {'pause_substrategy','switch_substrategy'} 配对
    //   - effect='switch_substrategy' 必须含 toSubStrategyScopeRef ≠ subStrategyScopeRef
    //   - target.phase='strategy' 本 PR substrate 不支持 → unsupported（readiness silent skip + evaluator silent skip 协同）
    //   - phase=entry 兜底（gate.regime 既有逻辑）
    if (node.kind === 'gate') {
      const target = node.target
      if (target?.phase === 'subStrategy') {
        const fieldPath = `orchestration.gate.subStrategy[${node.id}]`
        const pushSlot = (suffix: string, hint: string): void => {
          missingSlots.push({
            slotKey: `orchestration.gate.subStrategy.${suffix}`,
            fieldPath,
            status: 'open',
            priority: 'core',
            questionHint: hint,
            affectsExecution: true,
          })
        }
        const ref = typeof target.subStrategyScopeRef === 'string' ? target.subStrategyScopeRef.trim() : ''
        if (ref === '') {
          pushSlot('scope_ref_unknown', 'gate 引用的子策略 scope 未声明')
        }
        const effect = node.effectWhenFalse
        if (effect !== 'pause_substrategy' && effect !== 'switch_substrategy') {
          pushSlot('effect_phase_mismatch', 'phase=subStrategy 仅支持 pause_substrategy / switch_substrategy')
        }
        if (effect === 'switch_substrategy') {
          const to = typeof target.toSubStrategyScopeRef === 'string' ? target.toSubStrategyScopeRef.trim() : ''
          if (to === '') {
            pushSlot('switch_target_required', 'switch_substrategy gate 必须指定切换目标 scope')
          } else if (to === ref) {
            pushSlot('switch_target_self', '切换目标不能与源 scope 相同')
          }
        }
        if (node.activeWhen === undefined) {
          pushSlot('active_when', '请确认 gate 的判定条件')
        }
        return { ok: missingSlots.length === 0, missingSlots }
      }
      if (target?.phase === 'strategy') {
        // phase=strategy unsupported（留 issue #984 的第 5 项 strategy 子级 PR）
        missingSlots.push({
          slotKey: 'orchestration.gate.unsupported_phase',
          fieldPath: `orchestration.gate[${node.id}]`,
          status: 'open',
          priority: 'core',
          questionHint: '当前不支持 phase=strategy 的 gate',
          affectsExecution: true,
        })
        return { ok: false, missingSlots }
      }
      // 误配 entry phase + non block_new_entries effect
      if ((!target || target.phase === 'entry') && node.effectWhenFalse !== undefined && node.effectWhenFalse !== 'block_new_entries') {
        missingSlots.push({
          slotKey: 'orchestration.gate.regime.effect_phase_mismatch',
          fieldPath: `orchestration.gate.regime[${node.id}]`,
          status: 'open',
          priority: 'core',
          questionHint: 'phase=entry 仅支持 block_new_entries effect',
          affectsExecution: true,
        })
        return { ok: false, missingSlots }
      }
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
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    if (node.key === PROGRAM_DYNAMIC_GRID_KEY) {
      return this.validateDynamicGridProgramNode(node)
    }
    if (node.key === PROGRAM_ADAPTIVE_VOLATILITY_GRID_KEY) {
      return this.validateAdaptiveVolatilityGridNode(node)
    }
    // Phase 5 S12 (#1118): event_listener
    if (node.key === PROGRAM_EVENT_LISTENER_KEY) {
      return this.validateEventListenerProgramNode(node, siblingNodes)
    }
    return this.validateFixedGridGatedNode(node)
  }

  private validateFixedGridGatedNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
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
      pushSlot('program_kind', '请确认 program 节点的 key（仅支持 program.fixed_grid_gated / program.dynamic_grid / program.adaptive_volatility_grid / program.event_listener）')
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

  /**
   * adaptive_volatility_grid 节点 9 个 open slot ↔ readiness 16 fail-closed 一一映射：
   *   atr_period (#6) / atr_multiplier (#7) / range_multiplier (#8)
   *   min_step_pct (#11) / max_step_pct (#12) / level_count (#14)
   *   sizing (#15) / active_when_ref (#16) / rebuild_cooldown_sec (#10)
   */
  private validateAdaptiveVolatilityGridNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.program.adaptive_volatility_grid[${node.id}]`
    const pushSlot = (field: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.program.adaptive_volatility_grid.${field}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.programKind !== 'adaptive_volatility_grid') {
      pushSlot('program_kind', '请确认 programKind 为 adaptive_volatility_grid')
    }

    const onDeactivate = node.onDeactivate
    if (onDeactivate !== 'cancel' && onDeactivate !== 'keep' && onDeactivate !== 'close') {
      pushSlot('on_deactivate', '请确认停用时行为（cancel/keep/close）')
    }

    if (node.rebuildPolicy !== 'atr_window') {
      pushSlot('rebuild_policy', '请确认重建策略（仅支持 atr_window）')
    }

    const isPositiveFinite = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0
    const isPositiveInteger = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v > 0

    if (!isPositiveInteger(node.atrPeriod) || node.atrPeriod < 2 || node.atrPeriod > 200) {
      pushSlot('atr_period', '请确认 ATR 周期（2..200 整数）')
    }

    if (!isPositiveFinite(node.atrMultiplier)) {
      pushSlot('atr_multiplier', '请确认 ATR 步长系数（>0 有限数）')
    }

    if (!isPositiveFinite(node.rangeMultiplier)) {
      pushSlot('range_multiplier', '请确认 ATR 区间系数（>0 有限数）')
    }

    if (
      typeof node.atrDriftPct !== 'number'
      || !Number.isFinite(node.atrDriftPct)
      || node.atrDriftPct <= 0
      || node.atrDriftPct > 100
    ) {
      pushSlot('atr_drift_pct', '请确认 ATR 漂移百分比（>0 且 ≤100）')
    }

    // Phase 5 S6 risk delta: rebuildCooldownSec 硬下限 300（与 S5 60s 区分）
    if (
      !isPositiveInteger(node.rebuildCooldownSec)
      || (node.rebuildCooldownSec ?? 0) < 300
    ) {
      pushSlot('rebuild_cooldown_sec', '请确认重建冷却时长（≥300 整数秒）')
    }

    if (!isPositiveFinite(node.minStepPct)) {
      pushSlot('min_step_pct', '请确认最小步长百分比（>0 有限数）')
    }

    if (!isPositiveFinite(node.maxStepPct)) {
      pushSlot('max_step_pct', '请确认最大步长百分比（>0 有限数）')
    }

    if (
      isPositiveFinite(node.minStepPct)
      && isPositiveFinite(node.maxStepPct)
      && (node.maxStepPct as number) < (node.minStepPct as number)
    ) {
      pushSlot('max_step_pct', '请确认最大步长不小于最小步长')
    }

    const levelCount = node.levelCount
    if (
      typeof levelCount !== 'number'
      || !Number.isFinite(levelCount)
      || !Number.isInteger(levelCount)
      || levelCount < 2
      || levelCount > 100
    ) {
      pushSlot('level_count', '请确认档位数量（2..100 整数）')
    }

    const sizing = node.sizing
    if (
      !sizing
      || (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct')
    ) {
      pushSlot('sizing', '请确认仓位模式（fixed_quote/fixed_base/fixed_pct）')
    } else if (!isPositiveFinite(sizing.value)) {
      pushSlot('sizing', '请确认仓位数值（>0 有限数）')
    }

    if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') {
      pushSlot('active_when_ref', '请确认 active_when_ref 引用的 gate 节点 id')
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  /**
   * Phase 5 S12 (#1118): event_listener 节点 13 fail-closed open slot 输出。
   *   1) node.key === 'program.event_listener'（路由前置已守门）
   *   2) programKind === 'event_listener'
   *   3) onDeactivate ∈ {'cancel','keep'}（'close' fail-closed — 无持仓语义；W5 守护）
   *   4) rebuildPolicy ∈ {'static','on_schema_version_bump'}
   *   5) eventSchemaRef === 'webhook_event'（S12 MVP 锁定）
   *   6) sourceRef trim 非空（cross-node ref check 在 readiness）
   *   7) permissionScope trim 非空 + 匹配 EVENT_LISTENER_PERMISSION_SCOPE_PATTERN
   *   8) idempotencyKey.fieldPath trim 非空 + 匹配 0-1 层 `.` regex
   *   9) dedupWindowMs 整数 ∈ [100, 3600000]
   *   10) expirationTtlMs 整数 ∈ [100, 86400000]
   *   11) expirationTtlMs > dedupWindowMs（严格大于）
   *   12) expirationPolicy ∈ {'drop','escalate'}
   *   13) activeWhenRef trim 非空（cross-node ref check 在 readiness）
   */
  private validateEventListenerProgramNode(
    node: SemanticOrchestrationNode,
    _siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.program.event_listener[${node.id}]`
    const pushSlot = (field: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.program.event_listener.${field}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.programKind !== 'event_listener') {
      pushSlot('program_kind', '请确认 programKind 为 event_listener')
    }

    if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep') {
      pushSlot('on_deactivate', '请确认停用时行为（cancel/keep；event_listener 不支持 close）')
    }

    if (node.rebuildPolicy !== 'static' && node.rebuildPolicy !== 'on_schema_version_bump') {
      pushSlot('rebuild_policy', '请确认重建策略（static / on_schema_version_bump）')
    }

    if (node.eventSchemaRef !== 'webhook_event') {
      pushSlot('event_schema_ref', '请确认事件 schema（仅支持 webhook_event）')
    }

    const sourceRef = typeof node.sourceRef === 'string' ? node.sourceRef.trim() : ''
    if (sourceRef === '') {
      pushSlot('source_ref', '请确认事件源数据节点 id（引用 scope.dataSource role=event）')
    }

    const permissionScope = typeof node.permissionScope === 'string' ? node.permissionScope.trim() : ''
    if (permissionScope === '' || !EVENT_LISTENER_PERMISSION_SCOPE_PATTERN.test(permissionScope)) {
      pushSlot('permission_scope', '请确认权限命名空间（小写字母开头，3-64 字符；如 tradingview:alpha）')
    }

    const idempotency = node.idempotencyKey
    const idempotencyPath = idempotency && typeof idempotency.fieldPath === 'string' ? idempotency.fieldPath.trim() : ''
    if (idempotencyPath === '' || !EVENT_LISTENER_FIELD_PATH_PATTERN.test(idempotencyPath)) {
      pushSlot('idempotency_key.field_path', '请确认幂等键 fieldPath（仅允许 0-1 层 "."，多层下钻不支持）')
    }

    const dedupWindowMs = node.dedupWindowMs
    if (
      typeof dedupWindowMs !== 'number'
      || !Number.isFinite(dedupWindowMs)
      || !Number.isInteger(dedupWindowMs)
      || dedupWindowMs < EVENT_LISTENER_DEDUP_WINDOW_MIN_MS
      || dedupWindowMs > EVENT_LISTENER_DEDUP_WINDOW_MAX_MS
    ) {
      pushSlot('dedup_window_ms', '请确认去重窗口毫秒（100..3600000 整数）')
    }

    const expirationTtlMs = node.expirationTtlMs
    const expirationValid =
      typeof expirationTtlMs === 'number'
      && Number.isFinite(expirationTtlMs)
      && Number.isInteger(expirationTtlMs)
      && expirationTtlMs >= EVENT_LISTENER_EXPIRATION_TTL_MIN_MS
      && expirationTtlMs <= EVENT_LISTENER_EXPIRATION_TTL_MAX_MS
    if (!expirationValid) {
      pushSlot('expiration_ttl_ms', '请确认事件过期 TTL 毫秒（100..86400000 整数）')
    }
    if (
      expirationValid
      && typeof dedupWindowMs === 'number'
      && Number.isFinite(dedupWindowMs)
      && expirationTtlMs! <= dedupWindowMs
    ) {
      pushSlot('expiration_ttl_ms', '请确认 expirationTtlMs 必须严格大于 dedupWindowMs')
    }

    if (node.expirationPolicy !== 'drop' && node.expirationPolicy !== 'escalate') {
      pushSlot('expiration_policy', '请确认过期事件处理策略（drop / escalate）')
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

  /**
   * Phase 5 S2 (#1104): scope.symbol 节点 6 重 fail-closed:
   *   1) key === 'scope.symbol'（其它 scope kind 仍 unsupported）
   *   2) symbolScopeKind === 'symbol'
   *   3) symbols 是非空字符串数组、去重、每项匹配 ^[A-Z]{2,5}USDT$、长度 ≤ 32
   *   4) primarySymbol（若提供）必须 ∈ symbols
   *   5) 与其它 supported scope.symbol 节点 symbols 不重叠（强制隔离）
   *   6) 与其它 supported scope.symbol primarySymbol 不冲突
   */
  private validateSymbolScopeNode(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.scope[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.scope.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    // Phase 5 S10 (#1111): scope 节点按 key 分发
    if (node.key === SCOPE_SUBSTRATEGY_KEY) {
      return this.validateSubStrategyScopeNode(node, siblingNodes)
    }
    if (node.key !== SCOPE_SYMBOL_KEY) {
      pushSlot('unsupported_kind', '当前仅支持 scope.symbol / scope.leg / scope.timeframe / scope.dataSource / scope.subStrategy')
      return { ok: false, missingSlots }
    }
    if (node.symbolScopeKind !== 'symbol') {
      pushSlot('symbol.scope_kind', '请确认 scopeKind 为 symbol')
    }

    const symbols = node.symbols
    if (!Array.isArray(symbols) || symbols.length === 0) {
      pushSlot('symbol.symbols', '请确认要绑定的标的列表')
      return { ok: false, missingSlots }
    }

    const trimmedSymbols: string[] = []
    let formatInvalid = false
    for (const raw of symbols) {
      if (typeof raw !== 'string') {
        formatInvalid = true
        continue
      }
      const trimmed = raw.trim()
      if (trimmed.length === 0 || trimmed.length > SYMBOL_MAX_LENGTH || !SYMBOL_FORMAT_PATTERN.test(trimmed)) {
        formatInvalid = true
        continue
      }
      trimmedSymbols.push(trimmed)
    }
    if (formatInvalid) {
      pushSlot('symbol.symbols', '标的需符合 ^[A-Z]{2,5}USDT$ 格式（如 BTCUSDT）')
    }
    const dedupedSet = new Set(trimmedSymbols)
    if (dedupedSet.size !== trimmedSymbols.length) {
      pushSlot('symbol.symbols', '标的列表不允许重复')
    }

    if (node.primarySymbol !== undefined) {
      const primary = typeof node.primarySymbol === 'string' ? node.primarySymbol.trim() : ''
      if (primary === '' || !dedupedSet.has(primary)) {
        pushSlot('symbol.primary_symbol', '主标的必须在标的列表中')
      }
    }

    // (5)(6) 多 scope 隔离检查 — 与其它 status='locked' 且 key='scope.symbol' 节点对比
    const otherSupportedScopes = siblingNodes.filter(
      (other) =>
        other.id !== node.id
        && other.kind === 'scope'
        && other.key === SCOPE_SYMBOL_KEY
        && other.status === 'locked',
    )
    for (const other of otherSupportedScopes) {
      const otherSymbols = Array.isArray(other.symbols) ? other.symbols : []
      const overlap = otherSymbols.some(
        (s) => typeof s === 'string' && dedupedSet.has(s.trim()),
      )
      if (overlap) {
        pushSlot('symbol.symbols_overlap', '多 scope 之间标的不能重叠')
        break
      }
    }
    const myPrimary = typeof node.primarySymbol === 'string' ? node.primarySymbol.trim() : ''
    if (myPrimary !== '') {
      const collision = otherSupportedScopes.some(
        (other) => typeof other.primarySymbol === 'string' && other.primarySymbol.trim() === myPrimary,
      )
      if (collision) {
        pushSlot('symbol.primary_symbol_collision', '多 scope 主标的必须各自唯一')
      }
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  /**
   * Phase 5 S11 (#1112): scope.leg 节点 8 重 fail-closed:
   *   1) kind === 'scope'
   *   2) key === 'scope.leg'
   *   3) legScopeKind === 'leg'（且与 symbolScopeKind='symbol' 互斥）
   *   4) legId 非空、匹配 ^[a-zA-Z][a-zA-Z0-9_.]{0,63}$、与同 state 其它 leg 节点 legId 不重复
   *   5) direction ∈ {'long','short'}
   *   6) instrumentRef trim 非空、引用同 state 中 status:'locked' 的 scope.symbol 节点 id
   *   7) legSizing 缺失允许；若提供：mode 合法 + value > 0；mode='fixed_ratio' 时 pairedLegId 非空、引用其它 leg 的 legId、且 direction 互反
   *   8) version-gate（caller 在 readiness 处理）
   */
  private validateLegScopeNode(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.scope.leg[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.scope.leg.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.key !== SCOPE_LEG_KEY) {
      pushSlot('unsupported_kind', '当前仅支持 scope.leg 子类型')
      return { ok: false, missingSlots }
    }
    if (node.legScopeKind !== 'leg') {
      pushSlot('leg_scope_kind', '请确认 legScopeKind 为 leg')
    }
    if (node.symbolScopeKind === 'symbol') {
      pushSlot('leg_scope_kind', 'scope.leg 节点不可同时持有 symbolScopeKind="symbol"')
    }

    const legId = typeof node.legId === 'string' ? node.legId.trim() : ''
    if (legId === '' || !LEG_ID_PATTERN.test(legId)) {
      pushSlot('leg_id', '请确认 legId（字母开头、字母数字下划线点、长度 ≤ 64）')
    }

    if (node.direction !== 'long' && node.direction !== 'short') {
      pushSlot('direction', '请确认腿方向（long/short）')
    }

    const instrumentRef = typeof node.instrumentRef === 'string' ? node.instrumentRef.trim() : ''
    if (instrumentRef === '') {
      pushSlot('instrument_ref', '请确认该腿绑定的 scope.symbol 节点 id')
    } else {
      const referenced = siblingNodes.find((other) => other.id === instrumentRef)
      const referencedOk = referenced !== undefined
        && referenced.kind === 'scope'
        && referenced.key === SCOPE_SYMBOL_KEY
        && referenced.status === 'locked'
      if (!referencedOk) {
        pushSlot('instrument_ref', '该腿引用的 scope.symbol 节点必须已存在且 readiness 已通过')
      }
    }

    const otherLegNodes = siblingNodes.filter(
      (other) =>
        other.id !== node.id
        && other.kind === 'scope'
        && other.key === SCOPE_LEG_KEY,
    )
    if (legId !== '') {
      const dup = otherLegNodes.some(
        (other) => typeof other.legId === 'string' && other.legId.trim() === legId,
      )
      if (dup) {
        pushSlot('leg_id', 'legId 在策略内必须唯一')
      }
    }

    const sizing = node.legSizing
    if (sizing !== undefined) {
      const modeOk = sizing.mode === 'fixed_pct' || sizing.mode === 'fixed_quote' || sizing.mode === 'fixed_ratio'
      if (!modeOk) {
        pushSlot('leg_sizing.mode', '请确认 legSizing.mode（fixed_pct/fixed_quote/fixed_ratio）')
      }
      if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
        pushSlot('leg_sizing.value', '请确认 legSizing.value（>0 有限数）')
      }
      if (sizing.mode === 'fixed_ratio') {
        const paired = typeof sizing.pairedLegId === 'string' ? sizing.pairedLegId.trim() : ''
        if (paired === '') {
          pushSlot('paired_leg_id', 'fixed_ratio 模式必须指定 pairedLegId')
        } else if (paired === legId) {
          pushSlot('paired_leg_id', 'pairedLegId 不可指向自身')
        } else {
          const pairedNode = otherLegNodes.find(
            (other) => typeof other.legId === 'string' && other.legId.trim() === paired,
          )
          if (!pairedNode) {
            pushSlot('paired_leg_id', 'pairedLegId 必须引用同 state 中其它 supported leg')
          } else if (
            pairedNode.direction === undefined
            || (pairedNode.direction === node.direction)
          ) {
            pushSlot('direction_collision', 'paired leg 必须方向相反（对冲腿）')
          }
        }
      }
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  /**
   * Phase 5 S3 (#1109): scope.timeframe 节点 10 重 fail-closed
   */
  private validateTimeframeScopeNode(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.scope.timeframe[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.scope.timeframe.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.key !== SCOPE_TIMEFRAME_KEY) {
      pushSlot('unsupported_key', '当前仅支持 scope.timeframe')
      return { ok: false, missingSlots }
    }
    if (node.timeframeScopeKind !== 'timeframe') {
      pushSlot('scope_kind', '请确认 scopeKind 为 timeframe')
    }

    const primaryMs = parseTimeframeMs(node.primaryTimeframe)
    if (primaryMs === null) {
      pushSlot('primary_timeframe', '请确认执行周期（主周期）')
    }

    const requiredRaw = node.requiredTimeframes
    if (!Array.isArray(requiredRaw)) {
      pushSlot('required_timeframes', '请确认依赖周期列表（≥1 个）')
      return { ok: false, missingSlots }
    }

    if (requiredRaw.length < TIMEFRAME_REQUIRED_MIN_LENGTH || requiredRaw.length > TIMEFRAME_REQUIRED_MAX_LENGTH) {
      pushSlot('required_length', `依赖周期数量必须在 ${TIMEFRAME_REQUIRED_MIN_LENGTH}..${TIMEFRAME_REQUIRED_MAX_LENGTH} 之间`)
    }

    const requiredMsList: number[] = []
    let formatInvalid = false
    for (const tf of requiredRaw) {
      const ms = parseTimeframeMs(tf)
      if (ms === null) {
        formatInvalid = true
        continue
      }
      requiredMsList.push(ms)
    }
    if (formatInvalid) {
      pushSlot('required_timeframes', '依赖周期需是支持的 timeframe vocab')
    }

    const dedupedRequired = new Set(requiredRaw.filter((tf): tf is string => typeof tf === 'string'))
    if (dedupedRequired.size !== requiredRaw.length) {
      pushSlot('required_timeframes', '依赖周期不允许重复')
    }

    if (typeof node.primaryTimeframe === 'string' && dedupedRequired.has(node.primaryTimeframe)) {
      pushSlot('required_timeframes', '主周期不能同时出现在依赖周期列表（自引用拒绝）')
    }

    // 粒度顺序：primary < min(required)（critic Round 2 C2-R2）
    if (primaryMs !== null && requiredMsList.length > 0) {
      const minRequiredMs = Math.min(...requiredMsList)
      if (primaryMs >= minRequiredMs) {
        pushSlot('primary_granularity', '主周期粒度必须严格细于所有依赖周期')
      }
    }

    if (node.alignmentPolicy !== 'strict' && node.alignmentPolicy !== 'tolerant') {
      pushSlot('alignment_policy', '请确认对齐严格度（strict / tolerant）')
    }

    // 与其它 locked sibling 比较 (primaryTimeframe, sortedRequired)
    const otherLockedScopes = siblingNodes.filter(
      (other) =>
        other.id !== node.id
        && other.kind === 'scope'
        && other.key === SCOPE_TIMEFRAME_KEY
        && other.status === 'locked',
    )
    if (typeof node.primaryTimeframe === 'string' && Array.isArray(node.requiredTimeframes)) {
      const myKey = JSON.stringify([node.primaryTimeframe, [...node.requiredTimeframes].sort()])
      for (const other of otherLockedScopes) {
        if (typeof other.primaryTimeframe === 'string' && Array.isArray(other.requiredTimeframes)) {
          const otherKey = JSON.stringify([other.primaryTimeframe, [...other.requiredTimeframes].sort()])
          if (otherKey === myKey) {
            pushSlot('duplicate_definition', '多 scope.timeframe 之间 (主周期, 依赖周期集合) 不能完全相同')
            break
          }
        }
      }
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  /**
   * Phase 5 S9 (#1110): scope.dataSource 节点 readiness fail-closed validate（plan §4.1 9 重 1..6）
   *   1) dataSourceScopeKind === 'dataSource'
   *   2) dataSourceRole ∈ {'primary','confirmation','event'}
   *   3) dataSourceFeedId trim 后非空 + 长度 ≤ 64 + 匹配 FEED_ID_FORMAT
   *   4) dataSourceSchemaRef ∈ DATA_SOURCE_SCHEMAS（所有 role 必填）
   *   5) cross-node：feedId 与其它 supported scope.dataSource 不重复
   *   6) cross-node：role='primary' 在所有 supported scope.dataSource 中最多 1 个
   * （第 7..9 重 registry 注册 + version-gate 由 readiness layer 检查）
   */
  private validateDataSourceScopeNode(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.scope.dataSource[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.scope.dataSource.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    if (node.dataSourceScopeKind !== 'dataSource') {
      pushSlot('scope_kind', '请确认 scopeKind 为 dataSource')
    }
    const role = node.dataSourceRole
    if (typeof role !== 'string' || !DATA_SOURCE_ROLES.has(role)) {
      pushSlot('role', '请确认数据源角色（primary/confirmation/event）')
    }

    const feedIdRaw = node.dataSourceFeedId
    const feedId = typeof feedIdRaw === 'string' ? feedIdRaw.trim() : ''
    if (feedId === '' || feedId.length > 64 || !FEED_ID_FORMAT_PATTERN.test(feedId)) {
      pushSlot('feed_id', '请确认数据源 feedId（如 binance.spot.btcusdt）')
    }

    const schemaRef = node.dataSourceSchemaRef
    if (typeof schemaRef !== 'string' || !DATA_SOURCE_SCHEMAS.has(schemaRef)) {
      pushSlot('schema_ref', '请确认数据源 schema（ohlcv/orderbook/liquidation/webhook_event）')
    }

    // (5)(6) 多 scope 之间隔离检查 — 与其它 status='locked' 且 key='scope.dataSource' 节点对比
    const otherSupportedScopes = siblingNodes.filter(
      (other) =>
        other.id !== node.id
        && other.kind === 'scope'
        && other.key === SCOPE_DATA_SOURCE_KEY
        && other.status === 'locked',
    )
    if (feedId !== '') {
      const overlap = otherSupportedScopes.some(
        (other) => typeof other.dataSourceFeedId === 'string' && other.dataSourceFeedId.trim() === feedId,
      )
      if (overlap) {
        pushSlot('feed_id_overlap', '多 scope 间 feedId 不能重复')
      }
    }
    if (role === 'primary') {
      const collision = otherSupportedScopes.some(
        (other) => other.dataSourceRole === 'primary',
      )
      if (collision) {
        pushSlot('primary_collision', 'primary 数据源最多一个')
      }
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  /**
   * Phase 5 S10 (#1111): scope.subStrategy 节点 5 重 fail-closed:
   *   1) key === 'scope.subStrategy'（路由前置已检）
   *   2) subStrategyScopeKind === 'subStrategy'
   *   3) subStrategyId 非空字符串、trim 后长度 ∈ [1, 64]
   *   4) positionHandlingOnDeactivate ∈ {'close','keep'} + orderHandlingOnDeactivate ∈ {'cancel','keep'}
   *   5) 与其它 status='locked' key='scope.subStrategy' 节点 subStrategyId 不冲突
   */
  private validateSubStrategyScopeNode(
    node: SemanticOrchestrationNode,
    siblingNodes: readonly SemanticOrchestrationNode[],
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.scope.subStrategy[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.scope.subStrategy.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    // (2) scopeKind 必须 === 'subStrategy'
    if (node.subStrategyScopeKind !== 'subStrategy') {
      pushSlot('scope_kind', '请确认 scopeKind 为 subStrategy')
    }

    // (3) subStrategyId 非空 + 长度
    const idRaw = node.subStrategyId
    const trimmedId = typeof idRaw === 'string' ? idRaw.trim() : ''
    if (trimmedId === '' || trimmedId.length > SUBSTRATEGY_ID_MAX_LENGTH) {
      pushSlot('substrategy_id', `请确认子策略 ID（非空且长度 ≤ ${SUBSTRATEGY_ID_MAX_LENGTH}）`)
    }

    // (4) positionHandling + orderHandling
    const posHandling = node.positionHandlingOnDeactivate
    if (posHandling !== 'close' && posHandling !== 'keep') {
      pushSlot('position_handling', '请确认子策略切换时是否平仓（close/keep）')
    }
    const orderHandling = node.orderHandlingOnDeactivate
    if (orderHandling !== 'cancel' && orderHandling !== 'keep') {
      pushSlot('order_handling', '请确认子策略切换时是否取消挂单（cancel/keep）')
    }

    // (5) 与其它 supported scope.subStrategy 节点 subStrategyId 不冲突
    if (trimmedId !== '') {
      const otherSupported = siblingNodes.filter(
        (other) =>
          other.id !== node.id
          && other.kind === 'scope'
          && other.key === SCOPE_SUBSTRATEGY_KEY
          && other.status === 'locked',
      )
      const collision = otherSupported.some(
        (other) => typeof other.subStrategyId === 'string' && other.subStrategyId.trim() === trimmedId,
      )
      if (collision) {
        pushSlot('id_collision', '多 scope 子策略 ID 必须唯一')
      }
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  // Phase 5 S8 (#1119): validateSymbolExposureCapNode
  private validateSymbolExposureCapNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.portfolioRisk.symbol_exposure_cap[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.portfolioRisk.symbol_exposure_cap.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    // (1) scope 必须为 'symbol'
    if (node.scope !== 'symbol') {
      pushSlot('scope_mismatch', 'portfolioRisk.symbol_exposure_cap scope 必须为 symbol')
    }
    // (2) notionalCapPct 必须为 (0, 100]
    const cap = node.notionalCapPct
    if (
      cap === undefined
      || typeof cap !== 'number'
      || Number.isNaN(cap)
      || cap <= 0
      || cap > 100
    ) {
      pushSlot('notional_cap_pct', '请确认标的名义敞口上限百分比（0..100]）')
    }
    // (3) mode 必须为 observe | enforce
    if (node.mode !== 'observe' && node.mode !== 'enforce') {
      pushSlot('mode', '请确认护栏模式（observe/enforce）')
    }
    // (4) effectWhenTriggered 必须为 block_new_entries | reduce_exposure
    if (
      node.effectWhenTriggered !== 'block_new_entries'
      && node.effectWhenTriggered !== 'reduce_exposure'
    ) {
      pushSlot('effect', 'symbol_exposure_cap 效果必须为 block_new_entries 或 reduce_exposure')
    }
    // (5) boundSymbolScopeRef 如存在需为非空字符串
    if (
      node.boundSymbolScopeRef !== undefined
      && (typeof node.boundSymbolScopeRef !== 'string' || node.boundSymbolScopeRef.trim() === '')
    ) {
      pushSlot('bound_symbol_scope_ref', 'boundSymbolScopeRef 必须为非空字符串')
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }

  // Phase 5 S8 (#1119): validateSubStrategyExposureCapNode
  private validateSubStrategyExposureCapNode(
    node: SemanticOrchestrationNode,
  ): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    const fieldPath = `orchestration.portfolioRisk.substrategy_exposure_cap[${node.id}]`
    const pushSlot = (suffix: string, hint: string): void => {
      missingSlots.push({
        slotKey: `orchestration.portfolioRisk.substrategy_exposure_cap.${suffix}`,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: hint,
        affectsExecution: true,
      })
    }

    // (1) scope 必须为 'subStrategy'
    if (node.scope !== 'subStrategy') {
      pushSlot('scope_mismatch', 'portfolioRisk.substrategy_exposure_cap scope 必须为 subStrategy')
    }
    // (2) notionalCapPct 必须为 (0, 100]
    const cap = node.notionalCapPct
    if (
      cap === undefined
      || typeof cap !== 'number'
      || Number.isNaN(cap)
      || cap <= 0
      || cap > 100
    ) {
      pushSlot('notional_cap_pct', '请确认子策略名义敞口上限百分比（0..100]）')
    }
    // (3) mode 必须为 observe | enforce
    if (node.mode !== 'observe' && node.mode !== 'enforce') {
      pushSlot('mode', '请确认护栏模式（observe/enforce）')
    }
    // (4) effectWhenTriggered 必须为 block_new_entries | pause_substrategy
    if (
      node.effectWhenTriggered !== 'block_new_entries'
      && node.effectWhenTriggered !== 'pause_substrategy'
    ) {
      pushSlot('effect', 'substrategy_exposure_cap 效果必须为 block_new_entries 或 pause_substrategy')
    }
    // (5) boundSubStrategyScopeRef 如存在需为非空字符串
    if (
      node.boundSubStrategyScopeRef !== undefined
      && (typeof node.boundSubStrategyScopeRef !== 'string' || node.boundSubStrategyScopeRef.trim() === '')
    ) {
      pushSlot('bound_substrategy_scope_ref', 'boundSubStrategyScopeRef 必须为非空字符串')
    }

    return { ok: missingSlots.length === 0, missingSlots }
  }
}
