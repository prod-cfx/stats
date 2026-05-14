import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'

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
import { ATOM_CONTRACT_REGISTRY, ATOM_BUCKETS, ATOM_PUBLIC_NAMES } from '../atom-contracts/atom-contract-registry'

type UnknownSemanticAtomDefinition = SemanticUnknownAtomDefinition
type ExecutableAtomOptions = { executableSinceVersion?: string }

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

// 多周期 HTF 过滤：5 个解构参数对应 IR EXPRESSION_GUARD 的 series.indicator/period + COMPARE.op + rhs
// 与 canonical-spec-v2-ir-compiler.service.ts compilePhase1GateAtom() 的 strategy.multi_timeframe 分支严格对齐：
//   - htfTimeframe: 高周期标签（如 '4h' / '1d'），用于 ensureIndicatorSeries / ensurePriceSeries 的 timeframe
//   - htfIndicator: 'ma' | 'sma' | 'ema' | 'rsi'，决定 SMA/EMA/RSI 系列
//   - htfPeriod: 指标周期（>0 的整数）
//   - htfOp: 'GT' | 'GTE' | 'LT' | 'LTE'，会被 flipGateOperator 反转为 guard 触发条件
//   - htfRhs: 'price' | 'value'，'price' 走 HTF close 序列；'value' 时 htfValue 必填
// htfCondition 自由文本由 seed-extractor 解析为上述 5 键后再注入；不再作为 required slot。
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

function multiTimeframeTrigger(): SemanticSupportedAtomDefinition {
  return {
    key: 'strategy.multi_timeframe',
    category: 'trigger',
    supportStatus: 'supported_requires_slot',
    // 与 IR compiler 5 解构键严格对齐；htfValue 仅在 htfRhs === 'value' 时必填，
    // 由 IR compiler 内做条件 readiness 校验（fail-closed 进入 supported_requires_slot），
    // 故归入 defaultableParams，避免在 readiness 层强制全部用户答辩。
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
  }
}

// Phase 3 MVP — price.previous_extrema 升级为 supported_requires_slot：
// requiredParams 与 IR compiler `compileConditionAtom` 中 'price.previous_extrema' 分支严格对齐：
//   - kind: 'prev_high' | 'prev_low' | 'swing_high' | 'swing_low'，决定走 HIGHEST_HIGH 或 LOWEST_LOW
//   - lookback: 滚动窗口大小（>0 的整数）
//   - memoryKey: 给后续 cross-atom 复用预留的 contract 占位；缺失时由 semantic-state-normalization 自动以 hash 补齐
// pivotStrength / confirmationBars 当前 MVP 用 IR 默认值，不强制用户答辩，故归入 defaultableParams。
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

function previousExtremaTrigger(): SemanticSupportedAtomDefinition {
  return {
    key: 'price.previous_extrema',
    category: 'trigger',
    supportStatus: 'supported_requires_slot',
    requiredParams: ['kind', 'lookback', 'memoryKey'],
    defaultableParams: ['pivotStrength', 'confirmationBars'],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: PREVIOUS_EXTREMA_OPEN_SLOTS.map(slot => ({ ...slot })),
    contractSubstrate: previousExtremaSubstrate(),
  }
}

// P4-5: external.signal — atom-only `supported_requires_slot`，无 webhook 运行时基建
// （ingestion / HMAC verify / signal queue 另开 follow-up issue）。
// 用户必须显式指明 provider + signalId + secret，否则 atom 一直处于 open_slots 状态，
// 不会进入 canonical 落地路径，避免任何"接收外部喊单后自动开仓"的静默执行。
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
  //   priority='context' 不阻断；core 三 slot 不变（保 P4-5 已 ship 行为）
  //   真正"atom 读 lifecycle 触发"close-loop 留 follow-up issue
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

function externalSignalTrigger(): SemanticSupportedAtomDefinition {
  return {
    key: 'external.signal',
    category: 'trigger',
    supportStatus: 'supported_requires_slot',
    requiredParams: ['provider', 'signalId', 'secret'],
    defaultableParams: [],
    // executableSinceVersion 显式 undefined：webhook runtime 基建未落地，
    // canonical/runtime 路径暂不可用；slot 全部填齐后仍停在 requires_slot 状态。
    // executableProjection 仅声明未来 projection 目标（external_signal_runtime）作为占位，
    // 与 sibling supported_requires_slot atoms 保持非空 projection 约束一致。
    executableProjection: ['external_signal_runtime'],
    openSlots: EXTERNAL_SIGNAL_OPEN_SLOTS.map(slot => ({ ...slot })),
    contractSubstrate: externalSignalSubstrate(),
  }
}

const ATOMS: SemanticRegisteredAtomDefinition[] = [
  executableTrigger('execution.on_start', ['timing', 'orderType', 'occurrence']),
  executableTrigger('condition.expression', []),
  executableTrigger('semantic.missing_entry_atom', []),
  executableTrigger('semantic.missing_exit_atom', []),
  executableTrigger('price.percent_change', ['valuePct']),
  executableTrigger('price.breakout_up', ['reference']),
  executableTrigger('price.breakout_down', ['reference']),
  executableTrigger('price.rolling_extrema_breakout', ['extrema', 'event']),
  executableTrigger('price.range_position_lte', ['lookbackBars', 'thresholdPct']),
  executableTrigger('price.range_position_gte', ['lookbackBars', 'thresholdPct']),
  executableTrigger('price.detect.indicator_boundary', ['indicator', 'boundaryRole']),
  executableTrigger('condition.sequence', ['sequenceKind']),
  executableTrigger('confirmation.rebound', []),
  executableTrigger('logical.any_of', ['items']),
  executableTrigger('volume.relative_average', ['lookbackBars', 'multiplier']),
  executableTrigger('indicator.cross_over', ['indicator', 'fastPeriod', 'slowPeriod']),
  executableTrigger('indicator.cross_under', ['indicator', 'fastPeriod', 'slowPeriod']),
  executableTrigger('indicator.threshold_gte', ['indicator', 'value']),
  executableTrigger('indicator.threshold_lte', ['indicator', 'value']),
  executableTrigger('indicator.boundary_touch', ['indicator', 'boundaryRole']),
  executableTrigger('indicator.boundary_cross', ['indicator', 'boundaryRole']),
  executableTrigger('bollinger.touch_upper', ['period', 'stdDev']),
  executableTrigger('bollinger.touch_lower', ['period', 'stdDev']),
  executableTrigger('bollinger.touch_middle', ['period', 'stdDev']),
  executableTrigger('oscillator.rsi_gte', ['value']),
  executableTrigger('oscillator.rsi_lte', ['value']),
  executableTrigger('trend.direction', ['value']),
  executableTrigger('market.regime', ['value']),
  executableTrigger('volatility.state', ['value']),
  executableTrigger('market.volatility_state', ['state']),
  executableTrigger('grid.price_levels', []),
  executableTrigger('grid.fixed_range', []),
  executableTrigger('grid.range_rebalance', []),
  executableAction('open_long'),
  executableAction('open_short'),
  executableAction('close_long'),
  executableAction('close_short'),
  executableAction('close_position'),
  executableAction('action.reduce_position'),
  executableAction('reduce_long'),
  executableAction('reduce_short'),
  executableAction('action.add_position', ['addMode', 'addRatio'], { executableSinceVersion: '2026.05.W02' }),
  executableAction('action.reverse_position', ['fromSide', 'toSide', 'sameBarPolicy', 'sizingSource'], { executableSinceVersion: '2026.05.W02' }),
  executableAction('action.grid_ladder'),
  executableAction('place_limit_grid'),
  executableRisk('risk.condition_expression', []),
  executableRisk('risk.boundary_guard', []),
  executableRisk('risk.protective_exit', []),
  executableRisk('risk.stop_loss', []),
  executableRisk('risk.take_profit', []),
  executableRisk('risk.stop_loss_pct', ['valuePct']),
  executableRisk('risk.take_profit_pct', ['valuePct']),
  executableRisk('risk.atr_multiple_stop', ['multiple']),
  executableRisk('risk.atr_multiple_take_profit', ['multiple']),
  executableRisk('risk.remembered_level_stop', ['levelKey']),
  supportedRequiresSlotRisk('risk.falling_knife_guard', ['definition'], [
    {
      slotKey: 'risk.falling_knife_guard.definition',
      fieldPath: 'risk.params.definition',
      priority: 'risk',
      questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
    },
  ]),
  executableRisk('risk.trailing_stop_pct', ['valuePct']),
  executableRisk('risk.max_drawdown_pct', ['valuePct']),
  executableRisk('risk.max_single_loss_pct', ['valuePct']),
  executableRisk('risk.cooldown_bars', ['bars']),
  executableRisk('risk.time_stop_bars', ['maxBars', 'scope', 'effect'], timeStopBarsSubstrate()),
  executablePosition('position.fixed_pct', ['value']),
  executablePosition('position.fixed_notional', ['value', 'asset']),
  executablePosition('position.fixed_quantity', ['value', 'asset']),
  executablePosition('position.pyramiding_limit', [], pyramidingLimitSubstrate()),
  executablePosition('position.max_exposure_pct', [], maxExposurePctSubstrate()),
  executablePosition('position.dca_schedule', ['maxCount', 'capitalCap', 'perOrderSizing', 'triggerMode', 'exitRule'], dcaScheduleSubstrate(DCA_SCHEDULE_OPEN_SLOTS), { executableSinceVersion: '2026.05.W02' }),
  unsupported('market.trend', 'trigger', '市场趋势旧别名', 'market_state_alias_public_beta_unsupported', 'market.trend 是旧状态别名，当前投影仅支持 trend.direction。'),
  unsupported('market.range', 'trigger', '震荡区间旧别名', 'market_state_alias_public_beta_unsupported', 'market.range 是旧状态别名，当前投影仅支持 market.regime。'),
  unsupported('indicator.above', 'trigger', '指标静态高于条件', 'indicator_static_compare_public_beta_unsupported', '指标静态高于条件当前公测暂未支持生成和回测。'),
  unsupported('indicator.below', 'trigger', '指标静态低于条件', 'indicator_static_compare_public_beta_unsupported', '指标静态低于条件当前公测暂未支持生成和回测。'),
  previousExtremaTrigger(),
  externalSignalTrigger(),
  unsupported('volume.spike', 'trigger', '成交量放大', 'volume_condition_public_beta_unsupported', '成交量条件当前公测暂未支持生成和回测。'),
  executableTrigger('volume.threshold', ['value', 'operator', 'metric'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('volatility.atr_threshold', ['period', 'threshold', 'thresholdUnit', 'operator'], { executableSinceVersion: '2026.05.W02' }),
  unsupported('risk.atr_stop', 'risk', 'ATR 动态止损', 'atr_stop_public_beta_unsupported', 'ATR 动态止损当前公测暂未支持生成和回测。'),
  unsupported('risk.partial_take_profit', 'risk', '分批止盈', 'partial_take_profit_public_beta_unsupported', '多档分批止盈当前公测暂未支持生成和回测。'),
  unsupported('position.leverage', 'position', '策略杠杆声明', 'leverage_contract_public_beta_unsupported', '策略内声明杠杆当前公测暂未支持生成和回测。'),
  unsupported('position.margin_mode', 'position', '逐仓/全仓声明', 'margin_mode_public_beta_unsupported', '策略内切换逐仓/全仓当前公测暂未支持生成和回测。'),
  unsupported('grid.dynamic_grid', 'trigger', '动态网格', 'dynamic_grid_public_beta_unsupported', '动态网格当前公测暂未支持生成和回测。'),
  executableTrigger('strategy.time_window', ['timezone', 'windows'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('position.has_position', ['sideScope'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('position.no_position', ['sideScope'], { executableSinceVersion: '2026.05.W02' }),
  multiTimeframeTrigger(),
  executableTrigger('indicator.divergence', ['indicator', 'direction', 'pivotWindow', 'confirmationBars'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('price.candle_pattern', ['pattern', 'direction'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('price.chart_pattern', ['pattern', 'direction'], { executableSinceVersion: '2026.05.W02' }),
  executableTrigger('liquidity.sweep', ['direction', 'reference'], { executableSinceVersion: '2026.05.W02' }),
  unsupported('price.pattern', 'trigger', '图形形态', 'chart_pattern_public_beta_unsupported', '图形形态识别当前公测暂未支持生成和回测。'),
  unsupported('action.pause_trading', 'action', '暂停交易', 'pause_trading_public_beta_unsupported', '暂停交易动作当前公测暂未支持生成和回测。'),
]

// ── PR3: adaptContractToLegacyShape ──────────────────────────────────────────
// 将 ATOM_CONTRACT_REGISTRY 条目适配为 legacy SemanticRegisteredAtomDefinition 形态。
//
// 策略：以 legacy ATOMS 条目为基础形态，仅用 REGISTRY classifier 覆盖：
//   - supportStatus（supported_executable / recognized_unsupported）
//   - executableSinceVersion
//   - category（由 ATOM_BUCKETS 派生）
//   - unsupported 元数据（仅 unsupported atom）
//
// 对于 REGISTRY 中存在但 legacy 没有的 atom（LEGACY_MISSING_KEYS），
// 从 surface.paramSlots 构建基本形态。
//
// bucket → legacy category 映射：
//   trigger/action/risk → 直接；positionConstraint → 'position'；orchestration → 'orchestration'

// ── special-case key set for atoms only in REGISTRY (no legacy equivalent) ──
const LEGACY_MISSING_KEYS = new Set([
  'action.open_long',
  'action.close_long',
  'action.open_short',
  'action.close_short',
  'gate.regime',
  'portfolioRisk.symbol_exposure_cap',
  'portfolioRisk.substrategy_exposure_cap',
  'program.dynamic_grid',
  'program.fixed_grid_gated',
  'program.adaptive_volatility_grid',
  'program.event_listener',
  'scope.symbol',
  'scope.leg',
  'scope.timeframe',
  'scope.dataSource',
  'scope.subStrategy',
  'gate.subStrategy',
  'portfolioRisk.drawdown_block',
])

// Build a fresh legacy atom from REGISTRY entry for keys not in legacy ATOMS
const _LEGACY_ATOMS_MAP_PR4 = new Map(ATOMS.map(atom => [atom.key, atom]))

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

function adaptContractToLegacyShape(
  entryKey: string,
): SemanticRegisteredAtomDefinition {
  // 仅静态 atom 形态适配；运行期 params 化（如 risk.partial_take_profit）由调用方在 resolve 入口短路处理。
  const entry = (ATOM_CONTRACT_REGISTRY as Record<string, typeof ATOM_CONTRACT_REGISTRY[keyof typeof ATOM_CONTRACT_REGISTRY]>)[entryKey]
  const bucket = (ATOM_BUCKETS as Record<string, string>)[entryKey] ?? 'trigger'
  const category = bucketToCategory(bucket)
  const { classifier } = entry
  const isUnsupported = classifier.supportStatus !== 'supported_executable'

  if (isUnsupported) {
    const unsupportedMeta = (classifier as { unsupportedMeta: { reasonCode: string; publicReasonZh: string } }).unsupportedMeta
    const publicNames = ATOM_PUBLIC_NAMES as Record<string, { zh: string; en: string }>
    const displayName = publicNames[entryKey]?.zh ?? entryKey

    // Prefer legacy unsupported shape if available (preserves exact reasonCode/publicReason)
    const legacyAtom = _LEGACY_ATOMS_MAP_PR4.get(entryKey)
    if (legacyAtom && legacyAtom.supportStatus === 'recognized_unsupported') {
      return cloneAtom({
        ...legacyAtom,
        category,
      })
    }

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

  // Prefer legacy supported shape — only override classifier-derived fields.
  // PR3 阶段：所有 ATOM_CONTRACT_REGISTRY 命中此路径的 key 必然存在于 _LEGACY_ATOMS_MAP_PR4 中
  //   （三入口 get/resolve/list 都已用 LEGACY_MISSING_KEYS 短路掉 orchestration/scope 类）。
  // PR4 物理删 _LEGACY_ATOMS_MAP_PR4 时需把 LEGACY_MISSING_KEYS 路径补全（surface.paramSlots 派生）。
  const legacyAtom = _LEGACY_ATOMS_MAP_PR4.get(entryKey)
  if (!legacyAtom || legacyAtom.supportStatus === 'recognized_unsupported') {
    throw new Error(`adapt_legacy_shape_missing_for:${entryKey}`)
  }
  const executableSinceVersion = classifier.executableSinceVersion
  const base = cloneAtom(legacyAtom)
  // 保留 legacy supportStatus（supported_executable / supported_requires_slot），
  // 不强制 supported_executable——下游 list().filter(supportStatus) 依赖此区分。
  return {
    ...base,
    category,
    ...(executableSinceVersion !== undefined ? { executableSinceVersion } : {}),
  } as SemanticSupportedAtomDefinition
}


@Injectable()
export class SemanticAtomRegistryService {
  // PR3 阶段：REGISTRY 优先 + legacy ATOMS fallback 兜底 bare key（如 'open_long'）；
  // adapter 也用 _LEGACY_ATOMS_MAP_PR4 取 contractSubstrate 等 legacy 形态字段。
  // PR4 物理删 ATOMS 表 + 此 map 时，需先扫描所有 SemanticAtomRegistryService 调用方
  // 确认无 bare-key 调用残留，并把 adapter 中"prefer legacy supported shape"路径替换为
  // 完全从 ATOM_CONTRACT_REGISTRY 派生 contractSubstrate / openSlots / 等。
  private readonly _legacyAtoms = _LEGACY_ATOMS_MAP_PR4

  get(key: string): SemanticRegisteredAtomDefinition {
    if (key in ATOM_CONTRACT_REGISTRY && !LEGACY_MISSING_KEYS.has(key)) {
      return adaptContractToLegacyShape(key)
    }
    const atom = this._legacyAtoms.get(key)
    if (!atom) {
      throw new Error(`semantic_atom_not_registered:${key}`)
    }
    return cloneAtom(atom)
  }

  resolve(key: string, params?: Record<string, unknown>): SemanticRegisteredAtomDefinition | UnknownSemanticAtomDefinition {
    if (key === 'risk.partial_take_profit') {
      return resolvePartialTakeProfitAtom(params ?? {})
    }
    if (key in ATOM_CONTRACT_REGISTRY && !LEGACY_MISSING_KEYS.has(key)) {
      return adaptContractToLegacyShape(key)
    }
    // Fallback: legacy ATOMS (covers bare keys like 'open_long' not yet prefixed in REGISTRY)
    const legacyAtom = _LEGACY_ATOMS_MAP_PR4.get(key)
    if (legacyAtom) {
      return cloneAtom(legacyAtom)
    }
    return {
      key,
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    }
  }

  list(): SemanticRegisteredAtomDefinition[] {
    const result: SemanticRegisteredAtomDefinition[] = []
    const seen = new Set<string>()
    for (const key of Object.keys(ATOM_CONTRACT_REGISTRY)) {
      if (LEGACY_MISSING_KEYS.has(key)) continue
      if (key === 'risk.partial_take_profit') {
        result.push(resolvePartialTakeProfitAtom({}))
        seen.add(key)
        continue
      }
      result.push(adaptContractToLegacyShape(key))
      seen.add(key)
    }
    // bare-key fallback：legacy ATOMS 中存在但 REGISTRY 未覆盖的 key（如 'open_long'）保 list() 行为不变。
    // PR4 物理删 ATOMS 时同步清理此 fallback。
    for (const [key, atom] of this._legacyAtoms) {
      if (seen.has(key)) continue
      result.push(cloneAtom(atom))
    }
    return result
  }
}

function executableTrigger(
  key: string,
  requiredParams: string[],
  options?: ExecutableAtomOptions,
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'trigger',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate: baseExecutableSubstrate(),
    ...(options?.executableSinceVersion !== undefined
      ? { executableSinceVersion: options.executableSinceVersion }
      : {}),
  }
}

function executableAction(
  key: string,
  requiredParams: string[] = [],
  options?: ExecutableAtomOptions,
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'action',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate: baseExecutableSubstrate(),
    ...(options?.executableSinceVersion !== undefined
      ? { executableSinceVersion: options.executableSinceVersion }
      : {}),
  }
}

function executableRisk(
  key: string,
  requiredParams: string[],
  contractSubstrate: SemanticAtomContractSubstrate = baseExecutableSubstrate(),
  options?: ExecutableAtomOptions,
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate,
    ...(options?.executableSinceVersion !== undefined
      ? { executableSinceVersion: options.executableSinceVersion }
      : {}),
  }
}

function supportedRequiresSlotRisk(
  key: string,
  requiredParams: string[],
  openSlots: SemanticAtomDefinition['openSlots'],
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots,
    contractSubstrate: {
      ...baseExecutableSubstrate(),
      openSlots: cloneOpenSlotSpecs(openSlots),
    },
  }
}

function supportedRequiresSlotAction(
  key: string,
  requiredParams: string[],
  openSlots: SemanticAtomDefinition['openSlots'],
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'action',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots,
    contractSubstrate: {
      ...baseExecutableSubstrate(),
      openSlots: cloneOpenSlotSpecs(openSlots),
    },
  }
}

function executablePosition(
  key: string,
  requiredParams: string[],
  contractSubstrate: SemanticAtomContractSubstrate = positionSubstrate(),
  options?: ExecutableAtomOptions,
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'position',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate,
    ...(options?.executableSinceVersion !== undefined
      ? { executableSinceVersion: options.executableSinceVersion }
      : {}),
  }
}

function supportedRequiresSlotPosition(
  key: string,
  requiredParams: string[],
  openSlots: SemanticAtomDefinition['openSlots'],
  contractSubstrate: SemanticAtomContractSubstrate = {
    ...positionSubstrate(),
    openSlots: cloneOpenSlotSpecs(openSlots),
  },
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'position',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots,
    contractSubstrate,
  }
}

function unsupported(
  key: string,
  category: SemanticAtomDefinition['category'],
  displayName: string,
  reasonCode: string,
  publicReason: string,
): SemanticRecognizedUnsupportedAtomDefinition {
  return {
    key,
    category,
    supportStatus: 'recognized_unsupported',
    requiredParams: [],
    defaultableParams: [],
    executableProjection: [],
    openSlots: [],
    unsupported: {
      displayName,
      reasonCode,
      publicReason,
    },
    replacement: DEFAULT_REPLACEMENT,
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
