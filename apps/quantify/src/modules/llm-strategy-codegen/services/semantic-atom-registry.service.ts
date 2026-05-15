import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import { UNSUPPORTED_SKIP, type AtomContract, type ParamSlotSchema } from '../atom-contracts/atom-contract-types'

import type {
  SemanticAtomContractSubstrate,
  SemanticAtomDefinition,
  SemanticAtomOpenSlotSpec,
  SemanticAtomReplacementStrategy,
  SemanticRecognizedUnsupportedAtomDefinition,
  SemanticRegisteredAtomDefinition,
  SemanticSupportedAtomDefinition,
  SemanticUnknownAtomDefinition,
} from '../types/semantic-atom-support'
import { Injectable } from '@nestjs/common'
import { ATOM_CONTRACT_REGISTRY, ATOM_PUBLIC_NAMES } from '../atom-contracts/atom-contract-registry'

type UnknownSemanticAtomDefinition = SemanticUnknownAtomDefinition

// ── Substrate helpers ────────────────────────────────────────────────────────

function baseExecutableSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [
      { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
      { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
    ],
    stateRequirements: [],
    orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
    openSlots: [],
  }
}

function positionSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
}

function pyramidingLimitSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
    stateRequirements: [{ domain: 'state', verb: 'read_write', object: 'pyramiding_layer_count' }],
    orderRequirements: [],
    openSlots: [],
  }
}

function maxExposurePctSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
}

function timeStopBarsSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [
      { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
      { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
      { domain: 'runtime', verb: 'read', object: 'position.bars_held' },
    ],
    stateRequirements: [],
    orderRequirements: [
      { domain: 'order', verb: 'support', object: 'market_order' },
      { domain: 'order', verb: 'submit', object: 'market_close' },
    ],
    openSlots: [],
  }
}

const DCA_SCHEDULE_OPEN_SLOTS: SemanticAtomOpenSlotSpec[] = [
  {
    slotKey: 'position.dca_schedule.max_count',
    fieldPath: 'position.constraints[position.dca_schedule].params.maxCount',
    priority: 'risk',
    questionHint: '请确认 DCA 最多执行几次。',
  },
  {
    slotKey: 'position.dca_schedule.capital_cap',
    fieldPath: 'position.constraints[position.dca_schedule].params.capitalCap',
    priority: 'risk',
    questionHint: '请确认 DCA 总资金上限是多少。',
  },
  {
    slotKey: 'position.dca_schedule.per_order_sizing',
    fieldPath: 'position.constraints[position.dca_schedule].params.perOrderSizing',
    priority: 'risk',
    questionHint: '请确认每次 DCA 补仓多少。',
  },
  {
    slotKey: 'position.dca_schedule.trigger_mode',
    fieldPath: 'position.constraints[position.dca_schedule].params.triggerMode',
    priority: 'behavior',
    questionHint: '请确认 DCA 触发方式，例如价格间隔、时间间隔或信号触发。',
  },
  {
    slotKey: 'position.dca_schedule.exit_rule',
    fieldPath: 'position.constraints[position.dca_schedule].params.exitRule',
    priority: 'risk',
    questionHint: '请确认 DCA 停止或退出规则，例如跌破前低停止 / 达到止损退出 / 反向信号退出。',
  },
]

function dcaScheduleSubstrate(openSlots: SemanticAtomOpenSlotSpec[] = []): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
    stateRequirements: [{ domain: 'state', verb: 'read_write', object: 'dca_fired_count' }],
    orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
    openSlots,
  }
}

// ── Special-case open slots ──────────────────────────────────────────────────

// 多周期 HTF 过滤 open slots（与 canonical-spec-v2-ir-compiler.service.ts 严格对齐）
const MULTI_TIMEFRAME_OPEN_SLOTS: SemanticAtomOpenSlotSpec[] = [
  {
    slotKey: 'strategy.multi_timeframe.htfTimeframe',
    fieldPath: 'trigger.params.htfTimeframe',
    priority: 'core',
    questionHint: '请指明高周期过滤所用的时间周期，例如 4h / 1d。',
  },
  {
    slotKey: 'strategy.multi_timeframe.htfIndicator',
    fieldPath: 'trigger.params.htfIndicator',
    priority: 'core',
    questionHint: '请选择高周期使用的指标：ma / sma / ema / rsi。',
  },
  {
    slotKey: 'strategy.multi_timeframe.htfPeriod',
    fieldPath: 'trigger.params.htfPeriod',
    priority: 'core',
    questionHint: '请给出高周期指标的周期长度，例如 50 / 14。',
  },
  {
    slotKey: 'strategy.multi_timeframe.htfOp',
    fieldPath: 'trigger.params.htfOp',
    priority: 'core',
    questionHint: '请指明高周期判定的比较方向：GT / GTE / LT / LTE。',
  },
  {
    slotKey: 'strategy.multi_timeframe.htfRhs',
    fieldPath: 'trigger.params.htfRhs',
    priority: 'core',
    questionHint: '请指明高周期判定的比较右值：price（与 HTF 收盘价比较）或 value（与固定数值比较，需另填 htfValue）。',
  },
]

// price.previous_extrema open slots（与 IR compiler compileConditionAtom 严格对齐）
const PREVIOUS_EXTREMA_OPEN_SLOTS: SemanticAtomOpenSlotSpec[] = [
  {
    slotKey: 'price.previous_extrema.kind',
    fieldPath: 'trigger.params.kind',
    priority: 'core',
    questionHint: '请指明前高/前低判定类型：prev_high / prev_low / swing_high / swing_low。',
  },
  {
    slotKey: 'price.previous_extrema.lookback',
    fieldPath: 'trigger.params.lookback',
    priority: 'core',
    questionHint: '请给出滚动窗口长度，例如 20。',
  },
  {
    slotKey: 'price.previous_extrema.memoryKey',
    fieldPath: 'trigger.params.memoryKey',
    priority: 'behavior',
    questionHint: '请提供 memoryKey，用于跨 atom 复用 remembered level（缺失时系统会以 hash 自动补全）。',
  },
]

function previousExtremaSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [
      { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
      { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
      { domain: 'runtime', verb: 'compute', object: 'rolling_extrema' },
    ],
    stateRequirements: [{ domain: 'state', verb: 'write', object: 'memoryKey' }],
    orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
    openSlots: PREVIOUS_EXTREMA_OPEN_SLOTS.map(slot => ({ ...slot })),
  }
}

// P4-5: external.signal open slots（ingestion / HMAC verify / signal queue 另开 follow-up issue）
const EXTERNAL_SIGNAL_OPEN_SLOTS: SemanticAtomOpenSlotSpec[] = [
  {
    slotKey: 'external.signal.provider',
    fieldPath: 'trigger.params.provider',
    priority: 'core',
    questionHint: '请指明外部信号来源：tradingview / discord / telegram / webhook。',
  },
  {
    slotKey: 'external.signal.signalId',
    fieldPath: 'trigger.params.signalId',
    priority: 'core',
    questionHint: '请提供外部信号订阅 ID（用于过滤推送）。',
  },
  {
    slotKey: 'external.signal.secret',
    fieldPath: 'trigger.params.secret',
    priority: 'risk',
    questionHint: '请提供 HMAC 校验 secret，避免冒名信号触发开仓（可由系统生成后回填）。',
  },
  // Phase 5 S12 (#1118): 可选 slot — 关联到事件监听 program.event_listener 节点 id
  {
    slotKey: 'external.signal.programLifecycleStateRef',
    fieldPath: 'trigger.params.programLifecycleStateRef',
    priority: 'context',
    questionHint: '可选：关联到事件监听 program 节点 id，未填则保持独立 trigger 行为。',
  },
]

function externalSignalSubstrate(): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [
      // P4-5 atom-only: webhook ingestion / HMAC verify / signal queue 基建另开 issue
      { domain: 'runtime', verb: 'provide', object: 'external_signal_inbox' },
    ],
    stateRequirements: [{ domain: 'state', verb: 'read', object: 'last_signal_id' }],
    orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
    openSlots: EXTERNAL_SIGNAL_OPEN_SLOTS.map(slot => ({ ...slot })),
  }
}

// ── DEFAULT_REPLACEMENT (used by recognized_unsupported atoms) ──────────────

const DEFAULT_REPLACEMENT_PATCH: CodegenSemanticPatch = {
  triggers: [
    {
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: {
        indicator: 'ma',
        fastPeriod: 20,
        slowPeriod: 50,
        confirmationMode: 'bar_close',
      },
    },
    {
      key: 'indicator.cross_under',
      phase: 'exit',
      sideScope: 'long',
      params: {
        indicator: 'ma',
        fastPeriod: 20,
        slowPeriod: 50,
        confirmationMode: 'bar_close',
      },
    },
  ],
  actions: [
    { key: 'open_long' },
    { key: 'close_long' },
  ],
  risk: [
    {
      key: 'risk.stop_loss_pct',
      params: {
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      },
    },
    {
      key: 'risk.take_profit_pct',
      params: {
        valuePct: 10,
        direction: 'profit',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      },
    },
  ],
  position: {
    mode: 'fixed_ratio',
    value: 0.1,
    positionMode: 'long_only',
    sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
  },
}

const DEFAULT_REPLACEMENT: SemanticAtomReplacementStrategy = {
  strategyKey: 'ma_cross_with_fixed_risk',
  description: 'MA20 上穿 MA50 开多，MA20 下穿 MA50 平仓，5% 止损，10% 止盈，单笔 10% 仓位。',
  patch: DEFAULT_REPLACEMENT_PATCH,
}

// ── STANDALONE_ATOM_MAP ──────────────────────────────────────────────────────
// Atom 数据直接内联（PR4：物理删除 ATOMS 数组 + 工厂函数后的等价静态 Map）。
// 仅存放 ATOM_CONTRACT_REGISTRY 中尚未收录的 atom。
// ATOM_CONTRACT_REGISTRY 已收录的 atom 由 adaptContractToRegistryShape 统一派生。
//
// 规则：
//   - 任何时候向系统新增 atom，唯一入口为 ATOM_CONTRACT_REGISTRY（atom-contracts/README.md）
//   - 此 Map 仅用于向后兼容尚未迁移的 atom；禁止在此维护新 atom 元数据
const STANDALONE_ATOM_MAP = new Map<string, SemanticRegisteredAtomDefinition>([
  // ── REGISTRY atoms with legacy requiredParams that differ from REGISTRY paramSlots.required ──
  // (surface.paramSlots.required = "dispatcher 是否必须抽取"；legacy requiredParams = "策略完成所需参数")
  ['volume.threshold', {
    key: 'volume.threshold', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['value', 'operator', 'metric'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['volatility.atr_threshold', {
    key: 'volatility.atr_threshold', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['period', 'threshold', 'thresholdUnit', 'operator'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  // ── trigger atoms not yet in ATOM_CONTRACT_REGISTRY ──
  ['condition.expression', {
    key: 'condition.expression', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['semantic.missing_entry_atom', {
    key: 'semantic.missing_entry_atom', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['semantic.missing_exit_atom', {
    key: 'semantic.missing_exit_atom', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['price.rolling_extrema_breakout', {
    key: 'price.rolling_extrema_breakout', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['extrema', 'event'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['condition.sequence', {
    key: 'condition.sequence', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['sequenceKind'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['confirmation.rebound', {
    key: 'confirmation.rebound', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['logical.any_of', {
    key: 'logical.any_of', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['items'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['volume.relative_average', {
    key: 'volume.relative_average', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['lookbackBars', 'multiplier'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['indicator.threshold_gte', {
    key: 'indicator.threshold_gte', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['indicator', 'value'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['indicator.threshold_lte', {
    key: 'indicator.threshold_lte', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['indicator', 'value'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['indicator.boundary_touch', {
    key: 'indicator.boundary_touch', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['indicator', 'boundaryRole'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['indicator.boundary_cross', {
    key: 'indicator.boundary_cross', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['indicator', 'boundaryRole'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['market.volatility_state', {
    key: 'market.volatility_state', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: ['state'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['grid.price_levels', {
    key: 'grid.price_levels', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['grid.fixed_range', {
    key: 'grid.fixed_range', category: 'trigger', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['strategy.multi_timeframe', {
    key: 'strategy.multi_timeframe', category: 'trigger', supportStatus: 'supported_requires_slot',
    requiredParams: ['htfTimeframe', 'htfIndicator', 'htfPeriod', 'htfOp', 'htfRhs'],
    defaultableParams: ['htfValue'],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [...MULTI_TIMEFRAME_OPEN_SLOTS],
    contractSubstrate: {
      runtimeRequirements: [
        { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
        { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
        { domain: 'runtime', verb: 'feed', object: 'multi_timeframe', shape: { aligned: true } },
      ],
      stateRequirements: [],
      orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
      openSlots: cloneOpenSlotSpecs(MULTI_TIMEFRAME_OPEN_SLOTS),
    },
  }],
  ['price.previous_extrema', {
    key: 'price.previous_extrema', category: 'trigger', supportStatus: 'supported_requires_slot',
    requiredParams: ['kind', 'lookback', 'memoryKey'],
    defaultableParams: ['pivotStrength', 'confirmationBars'],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: PREVIOUS_EXTREMA_OPEN_SLOTS.map(slot => ({ ...slot })),
    contractSubstrate: previousExtremaSubstrate(),
  }],
  ['external.signal', {
    key: 'external.signal', category: 'trigger', supportStatus: 'supported_requires_slot',
    requiredParams: ['provider', 'signalId', 'secret'],
    defaultableParams: [],
    executableProjection: ['external_signal_runtime'],
    openSlots: EXTERNAL_SIGNAL_OPEN_SLOTS.map(slot => ({ ...slot })),
    contractSubstrate: externalSignalSubstrate(),
  }],
  // ── recognized_unsupported triggers ──
  ['market.trend', {
    key: 'market.trend', category: 'trigger', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '市场趋势旧别名', reasonCode: 'market_state_alias_public_beta_unsupported', publicReason: 'market.trend 是旧状态别名，当前投影仅支持 trend.direction。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['market.range', {
    key: 'market.range', category: 'trigger', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '震荡区间旧别名', reasonCode: 'market_state_alias_public_beta_unsupported', publicReason: 'market.range 是旧状态别名，当前投影仅支持 market.regime。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['volume.spike', {
    key: 'volume.spike', category: 'trigger', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '成交量放大', reasonCode: 'volume_condition_public_beta_unsupported', publicReason: '成交量条件当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  // ── action atoms (verb-derived bare keys — SemanticState.actions[].key 历史标签) ──
  ['open_long', {
    key: 'open_long', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['open_short', {
    key: 'open_short', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['close_long', {
    key: 'close_long', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['close_short', {
    key: 'close_short', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['close_position', {
    key: 'close_position', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['action.reduce_position', {
    key: 'action.reduce_position', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['reduce_long', {
    key: 'reduce_long', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['reduce_short', {
    key: 'reduce_short', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['action.grid_ladder', {
    key: 'action.grid_ladder', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['place_limit_grid', {
    key: 'place_limit_grid', category: 'action', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  // ── risk atoms not yet in ATOM_CONTRACT_REGISTRY ──
  ['risk.condition_expression', {
    key: 'risk.condition_expression', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.boundary_guard', {
    key: 'risk.boundary_guard', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.protective_exit', {
    key: 'risk.protective_exit', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.stop_loss', {
    key: 'risk.stop_loss', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.take_profit', {
    key: 'risk.take_profit', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [], executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.stop_loss_pct', {
    key: 'risk.stop_loss_pct', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['valuePct'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.take_profit_pct', {
    key: 'risk.take_profit_pct', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['valuePct'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.atr_multiple_stop', {
    key: 'risk.atr_multiple_stop', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['multiple'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.atr_multiple_take_profit', {
    key: 'risk.atr_multiple_take_profit', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['multiple'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.remembered_level_stop', {
    key: 'risk.remembered_level_stop', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['levelKey'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.falling_knife_guard', {
    key: 'risk.falling_knife_guard', category: 'risk', supportStatus: 'supported_requires_slot',
    requiredParams: ['definition'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [
      {
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk.params.definition',
        priority: 'risk',
        questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
      },
    ],
    contractSubstrate: {
      ...baseExecutableSubstrate(),
      openSlots: cloneOpenSlotSpecs([
        {
          slotKey: 'risk.falling_knife_guard.definition',
          fieldPath: 'risk.params.definition',
          priority: 'risk',
          questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
        },
      ]),
    },
  }],
  ['risk.trailing_stop_pct', {
    key: 'risk.trailing_stop_pct', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['valuePct'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.max_drawdown_pct', {
    key: 'risk.max_drawdown_pct', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['valuePct'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.max_single_loss_pct', {
    key: 'risk.max_single_loss_pct', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['valuePct'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.cooldown_bars', {
    key: 'risk.cooldown_bars', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['bars'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
  }],
  ['risk.time_stop_bars', {
    key: 'risk.time_stop_bars', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: ['maxBars', 'scope', 'effect'], defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: timeStopBarsSubstrate(),
  }],
  // Issue #1383 Lane A：promoted to supported_executable（仅解锁 registry 标志位；
  //   canonical_spec_v2 / compiled_runtime IR compile path 由 Lane C 兑现）。
  //   executableSinceVersion 锚定 2026.05.W02 与 atom-contract-registry classifier 对齐。
  ['risk.atr_stop', {
    key: 'risk.atr_stop', category: 'risk', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: ['period', 'multiple', 'pctOfAtr'],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [], contractSubstrate: baseExecutableSubstrate(),
    executableSinceVersion: '2026.05.W02',
  }],
  // ── position atoms not yet in ATOM_CONTRACT_REGISTRY ──
  ['position.fixed_pct', {
    key: 'position.fixed_pct', category: 'position', supportStatus: 'supported_executable',
    requiredParams: ['value'], defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [], contractSubstrate: positionSubstrate(),
  }],
  ['position.fixed_notional', {
    key: 'position.fixed_notional', category: 'position', supportStatus: 'supported_executable',
    requiredParams: ['value', 'asset'], defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [], contractSubstrate: positionSubstrate(),
  }],
  ['position.fixed_quantity', {
    key: 'position.fixed_quantity', category: 'position', supportStatus: 'supported_executable',
    requiredParams: ['value', 'asset'], defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [], contractSubstrate: positionSubstrate(),
  }],
  ['position.pyramiding_limit', {
    key: 'position.pyramiding_limit', category: 'position', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [], contractSubstrate: pyramidingLimitSubstrate(),
  }],
  ['position.max_exposure_pct', {
    key: 'position.max_exposure_pct', category: 'position', supportStatus: 'supported_executable',
    requiredParams: [], defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [], contractSubstrate: maxExposurePctSubstrate(),
  }],
  ['position.dca_schedule', {
    key: 'position.dca_schedule', category: 'position', supportStatus: 'supported_executable',
    requiredParams: ['maxCount', 'capitalCap', 'perOrderSizing', 'triggerMode', 'exitRule'],
    defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [...DCA_SCHEDULE_OPEN_SLOTS],
    contractSubstrate: dcaScheduleSubstrate(DCA_SCHEDULE_OPEN_SLOTS),
    executableSinceVersion: '2026.05.W02',
  }],
  // ── recognized_unsupported position / risk ──
  ['position.leverage', {
    key: 'position.leverage', category: 'position', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '策略杠杆声明', reasonCode: 'leverage_contract_public_beta_unsupported', publicReason: '策略内声明杠杆当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['position.margin_mode', {
    key: 'position.margin_mode', category: 'position', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '逐仓/全仓声明', reasonCode: 'margin_mode_public_beta_unsupported', publicReason: '策略内切换逐仓/全仓当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['grid.dynamic_grid', {
    key: 'grid.dynamic_grid', category: 'trigger', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '动态网格', reasonCode: 'dynamic_grid_public_beta_unsupported', publicReason: '动态网格当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['price.pattern', {
    key: 'price.pattern', category: 'trigger', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '图形形态', reasonCode: 'chart_pattern_public_beta_unsupported', publicReason: '图形形态识别当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
  ['action.pause_trading', {
    key: 'action.pause_trading', category: 'action', supportStatus: 'recognized_unsupported',
    requiredParams: [], defaultableParams: [], executableProjection: [], openSlots: [],
    unsupported: { displayName: '暂停交易', reasonCode: 'pause_trading_public_beta_unsupported', publicReason: '暂停交易动作当前公测暂未支持生成和回测。' },
    replacement: DEFAULT_REPLACEMENT,
  }],
])

// ── REGISTRY_ONLY_KEYS：仅在 ATOM_CONTRACT_REGISTRY 存在，不参与 list()/get()/resolve() 的 atom ──
// #1364 AC-4: orchestration / scope / portfolioRisk / gate / program 类 key 已移除。
// Task 6 后 server 端按 ATOM_CONTRACT_REGISTRY[key].bucket 强制归桶，
// 错位 atom 不再发生，黑名单失去意义。保留 lifecycle action key 供
// ImpliedActionSynthesizer 隐含合成使用。
const REGISTRY_ONLY_KEYS = new Set([
  // Issue #1313 PR5c：action.open_long 等已在 REGISTRY 注册（供 dispatcher 层消费），
  // 但 SemanticState.actions[].key 使用裸标签（'open_long' 等），不含点前缀。
  // legacy service resolve 这些 dotted 键必须返回 unsupported_unknown，不能从 REGISTRY 派生。
  'action.open_long',
  'action.close_long',
  'action.open_short',
  'action.close_short',
])

function bucketToCategory(bucket: string): SemanticAtomDefinition['category'] {
  switch (bucket) {
    case 'trigger': return 'trigger'
    case 'action': return 'action'
    case 'risk': return 'risk'
    case 'positionConstraint': return 'position'
    case 'orchestration': return 'context'
    default: throw new Error(`bucket_to_category_unknown:${bucket}`)
  }
}

// ── adaptContractToRegistryShape ─────────────────────────────────────────────
// 将 ATOM_CONTRACT_REGISTRY 条目完全从 REGISTRY 派生为 SemanticRegisteredAtomDefinition。
//
// 派生策略：
//   1. STANDALONE_ATOM_MAP 已有特殊 shape → 不走此路径（调用方检查优先级）
//   2. emit 已兑现可执行形态 → supported_executable（emit 是可编译能力单一真相源）
//   3. classifier.supportStatus !== 'supported_executable' → 构造 recognized_unsupported
//   4. 其他 → 从 surface.paramSlots 派生 requiredParams，按 category 选 contractSubstrate
function isExecutableByEmitCapability(entry: AtomContract): boolean {
  if (entry.readinessCheck === UNSUPPORTED_SKIP) {
    return false
  }

  switch (entry.emit.capabilityStatus) {
    case 'pr3a-condition':
      return true
    case 'pr3e-risk-guard':
      return typeof entry.emit.riskGuardShape === 'function'
    case 'pr3e-rule-block':
      return typeof entry.emit.ruleBlockShape === 'function'
    case 'pr3e-orchestration-portfolio':
      return typeof entry.emit.orchestrationPortfolioRiskShape === 'function'
    case 'pr3e-lifecycle':
      return typeof entry.emit.lifecyclePyramidingShape === 'function'
    case 'pr3e-action':
      return typeof entry.emit.actionShape === 'function'
    default:
      return false
  }
}

function matchesSurfaceParamCapability(
  entry: AtomContract,
  params: Record<string, unknown> | undefined,
): boolean {
  if (params === undefined) {
    return true
  }

  const surface = (entry as { surface?: { paramSlots?: Record<string, ParamSlotSchema> } }).surface
  const paramSlots = surface?.paramSlots ?? {}

  return Object.entries(params).every(([key, value]) => {
    const slot = paramSlots[key]
    if (slot?.kind !== 'enum' || slot.enum === undefined || typeof value !== 'string') {
      return true
    }

    return slot.enum.includes(value.trim().toLowerCase())
  })
}

function adaptContractToRegistryShape(
  entryKey: string,
  params?: Record<string, unknown>,
): SemanticRegisteredAtomDefinition {
  const entry = (ATOM_CONTRACT_REGISTRY as Record<string, typeof ATOM_CONTRACT_REGISTRY[keyof typeof ATOM_CONTRACT_REGISTRY]>)[entryKey]
  // #1364 PR1：bucket 从 contract.bucket 单点读（已删除独立 ATOM_BUCKETS 表导出）。
  // entry 缺失场景由下一行 `const { classifier } = entry` 解构隐式 throw —— 调用方契约
  // 保证 entryKey ∈ ATOM_CONTRACT_REGISTRY，无 fallback。
  const bucket = entry.bucket
  const category = bucketToCategory(bucket)
  const { classifier } = entry
  const isEmitPromotionAllowed = classifier.supportStatus === 'supported_executable'
    || params !== undefined
  const isExecutableByEmit = isEmitPromotionAllowed
    && isExecutableByEmitCapability(entry)
    && matchesSurfaceParamCapability(entry, params)
  const isUnsupported = classifier.supportStatus !== 'supported_executable' && !isExecutableByEmit

  if (isUnsupported) {
    const unsupportedMeta = (classifier as { unsupportedMeta: { reasonCode: string; publicReasonZh: string } }).unsupportedMeta
    const publicNames = ATOM_PUBLIC_NAMES as Record<string, { zh: string; en: string }>
    const displayName = publicNames[entryKey]?.zh ?? entryKey

    return {
      key: entryKey,
      category,
      supportStatus: 'recognized_unsupported',
      requiredParams: [],
      defaultableParams: [],
      executableProjection: [],
      openSlots: [],
      unsupported: {
        displayName,
        reasonCode: unsupportedMeta.reasonCode,
        publicReason: unsupportedMeta.publicReasonZh,
      },
      replacement: DEFAULT_REPLACEMENT,
    }
  }

  // 从 surface.paramSlots 派生 requiredParams
  const surface = (entry as { surface?: { paramSlots?: Record<string, { required?: boolean }> } }).surface
  const paramSlots = surface?.paramSlots ?? {}
  const requiredParams = Object.entries(paramSlots)
    .filter(([, schema]) => schema.required === true)
    .map(([k]) => k)

  const executableSinceVersion = (classifier as { executableSinceVersion?: string }).executableSinceVersion

  // contractSubstrate 和 executableProjection 按 category 派生
  const isPosition = category === 'position'
  const contractSubstrate = isPosition ? positionSubstrate() : baseExecutableSubstrate()
  const executableProjection: string[] = isPosition
    ? ['semantic_position_contract', 'compiled_runtime']
    : ['canonical_spec_v2', 'compiled_runtime']

  return {
    key: entryKey,
    category,
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection,
    openSlots: [],
    contractSubstrate,
    ...(executableSinceVersion !== undefined ? { executableSinceVersion } : {}),
  } as SemanticSupportedAtomDefinition
}

// ── resolveKey：按优先级查找 atom ─────────────────────────────────────────────
// 优先级：STANDALONE_ATOM_MAP > REGISTRY（非 REGISTRY_ONLY）
//
// STANDALONE_ATOM_MAP 存储了 legacy 精确 requiredParams / openSlots / contractSubstrate。
// 对于同时在 REGISTRY 和 STANDALONE 中存在的 atom，STANDALONE 优先——
// 因为 REGISTRY surface.paramSlots.required 语义（"dispatcher 是否必须抽取"）
// 与 legacy requiredParams 语义（"策略完成所需参数"）不一致；
// STANDALONE 保持了已稳定的 requiredParams 契约。
//
// executableSinceVersion 从 REGISTRY classifier 覆盖（保持版本门控最新）。
function resolveKey(key: string, params?: Record<string, unknown>): SemanticRegisteredAtomDefinition | null {
  // STANDALONE 优先
  if (STANDALONE_ATOM_MAP.has(key)) {
    const standalone = cloneAtom(STANDALONE_ATOM_MAP.get(key)!)
    // 若 REGISTRY 也有该 key，用 REGISTRY classifier.executableSinceVersion 覆盖
    if (key in ATOM_CONTRACT_REGISTRY && !REGISTRY_ONLY_KEYS.has(key)) {
      const entry = (ATOM_CONTRACT_REGISTRY as Record<string, typeof ATOM_CONTRACT_REGISTRY[keyof typeof ATOM_CONTRACT_REGISTRY]>)[key]
      const executableSinceVersion = (entry.classifier as { executableSinceVersion?: string }).executableSinceVersion
      if (executableSinceVersion !== undefined && standalone.supportStatus !== 'recognized_unsupported') {
        return { ...standalone, executableSinceVersion } as SemanticSupportedAtomDefinition
      }
    }
    return standalone
  }
  // 查 REGISTRY（非 orchestration 类）
  if (key in ATOM_CONTRACT_REGISTRY && !REGISTRY_ONLY_KEYS.has(key)) {
    return adaptContractToRegistryShape(key, params)
  }
  return null
}


@Injectable()
export class SemanticAtomRegistryService {
  get(key: string): SemanticRegisteredAtomDefinition {
    const atom = resolveKey(key)
    if (!atom) {
      throw new Error(`semantic_atom_not_registered:${key}`)
    }
    return atom
  }

  resolve(key: string, params?: Record<string, unknown>): SemanticRegisteredAtomDefinition | UnknownSemanticAtomDefinition {
    if (key === 'risk.partial_take_profit') {
      return resolvePartialTakeProfitAtom(params ?? {})
    }
    const atom = resolveKey(key, params)
    if (!atom) {
      return {
        key,
        category: 'unknown',
        supportStatus: 'unsupported_unknown',
      }
    }
    return atom
  }

  list(): SemanticRegisteredAtomDefinition[] {
    const result: SemanticRegisteredAtomDefinition[] = []
    const seen = new Set<string>()

    // REGISTRY atoms (non-orchestration only)
    for (const key of Object.keys(ATOM_CONTRACT_REGISTRY)) {
      if (REGISTRY_ONLY_KEYS.has(key)) continue
      if (key === 'risk.partial_take_profit') {
        result.push(resolvePartialTakeProfitAtom({}))
        seen.add(key)
        continue
      }
      result.push(resolveKey(key)!)
      seen.add(key)
    }

    // STANDALONE atoms not covered by REGISTRY
    for (const [key, atom] of STANDALONE_ATOM_MAP) {
      if (seen.has(key)) continue
      result.push(cloneAtom(atom))
      seen.add(key)
    }

    return result
  }
}

const PARTIAL_TAKE_PROFIT_OPEN_SLOTS: SemanticAtomOpenSlotSpec[] = [
  {
    slotKey: 'risk.partial_take_profit.tiers',
    fieldPath: 'risk.params.tiers',
    priority: 'risk',
    questionHint: '请说明分批止盈每档的触发条件（PnL 百分比）和减仓比例',
  },
]

function partialTakeProfitSubstrate(memoryKey: string): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [
      { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
      { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
      { domain: 'runtime', verb: 'provide', object: 'position_pnl_pct' },
    ],
    stateRequirements: [
      { domain: 'state', verb: 'read_write', object: memoryKey },
    ],
    orderRequirements: [
      { domain: 'order', verb: 'support', object: 'reduce_only' },
    ],
    openSlots: [],
  }
}

function resolvePartialTakeProfitAtom(
  params: Record<string, unknown>,
): SemanticRegisteredAtomDefinition {
  const tiers = params.tiers
  const memoryKey = params.memoryKey
  const hasValidTiers = Array.isArray(tiers) && tiers.length > 0
  const hasValidMemoryKey = typeof memoryKey === 'string' && memoryKey.startsWith('partial_tp_')

  if (hasValidTiers && hasValidMemoryKey) {
    return {
      key: 'risk.partial_take_profit',
      category: 'risk',
      supportStatus: 'supported_executable',
      requiredParams: ['tiers', 'memoryKey'],
      defaultableParams: [],
      executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
      openSlots: [],
      contractSubstrate: partialTakeProfitSubstrate(memoryKey as string),
      executableSinceVersion: '2026.05.W02',
    }
  }

  return {
    key: 'risk.partial_take_profit',
    category: 'risk',
    supportStatus: 'supported_requires_slot',
    requiredParams: ['tiers', 'memoryKey'],
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [...PARTIAL_TAKE_PROFIT_OPEN_SLOTS],
    contractSubstrate: {
      ...baseExecutableSubstrate(),
      openSlots: [...PARTIAL_TAKE_PROFIT_OPEN_SLOTS],
    },
  }
}

function cloneAtom(atom: SemanticRegisteredAtomDefinition): SemanticRegisteredAtomDefinition {
  if (atom.supportStatus === 'recognized_unsupported') {
    return {
      ...atom,
      requiredParams: [...atom.requiredParams],
      defaultableParams: [...atom.defaultableParams],
      executableProjection: [...atom.executableProjection],
      openSlots: cloneOpenSlotSpecs(atom.openSlots),
      unsupported: { ...atom.unsupported },
      ...(atom.replacement ? { replacement: cloneReplacement(atom.replacement) } : {}),
    }
  }

  return {
    ...atom,
    requiredParams: [...atom.requiredParams],
    defaultableParams: [...atom.defaultableParams],
    executableProjection: [...atom.executableProjection],
    openSlots: cloneOpenSlotSpecs(atom.openSlots),
    contractSubstrate: cloneContractSubstrate(atom.contractSubstrate),
  }
}

function cloneContractSubstrate(substrate: SemanticAtomContractSubstrate): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: substrate.runtimeRequirements.map(requirement => ({ ...requirement })),
    stateRequirements: substrate.stateRequirements.map(requirement => ({ ...requirement })),
    orderRequirements: substrate.orderRequirements.map(requirement => ({ ...requirement })),
    openSlots: cloneOpenSlotSpecs(substrate.openSlots),
  }
}

function cloneOpenSlotSpecs(openSlots: readonly SemanticAtomOpenSlotSpec[]): SemanticAtomOpenSlotSpec[] {
  return openSlots.map(slot => ({ ...slot }))
}

function cloneReplacement(replacement: SemanticAtomReplacementStrategy): SemanticAtomReplacementStrategy {
  return {
    ...replacement,
    patch: structuredClone(replacement.patch) as CodegenSemanticPatch,
  }
}
