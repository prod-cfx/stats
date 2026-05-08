import { Injectable } from '@nestjs/common'

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

type UnknownSemanticAtomDefinition = SemanticUnknownAtomDefinition

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

const DCA_SCHEDULE_EXIT_RULE_OPEN_SLOT: SemanticAtomOpenSlotSpec = {
  slotKey: 'position.dca_schedule.exit_rule',
  fieldPath: 'position.constraints.params.exitRule',
  priority: 'risk',
  questionHint: '请确认 DCA 停止或退出规则，例如跌破前低停止 / 达到止损退出 / 反向信号退出。',
}

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
  supportedRequiresSlotAction('action.add_position', [], [
    {
      slotKey: 'action.add_position.constraint',
      fieldPath: 'actions.params.constraint',
      priority: 'risk',
      questionHint: '请确认加仓的约束，例如最大加仓次数或最大总敞口比例。',
    },
  ]),
  supportedRequiresSlotAction('action.reverse_position', ['sameBarPolicy', 'sizingSource'], [
    {
      slotKey: 'action.reverse_position.same_bar_policy',
      fieldPath: 'actions.params.sameBarPolicy',
      priority: 'behavior',
      questionHint: '请确认反手是否允许在同一根 K 线内完成。',
    },
    {
      slotKey: 'action.reverse_position.sizing_source',
      fieldPath: 'actions.params.sizingSource',
      priority: 'risk',
      questionHint: '请确认反手仓位大小来源，例如沿用原仓位或使用固定仓位。',
    },
  ]),
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
  executablePosition('position.fixed_pct', ['value']),
  executablePosition('position.fixed_notional', ['value', 'asset']),
  executablePosition('position.fixed_quantity', ['value', 'asset']),
  executablePosition('position.pyramiding_limit', [], pyramidingLimitSubstrate()),
  executablePosition('position.max_exposure_pct', [], maxExposurePctSubstrate()),
  supportedRequiresSlotPosition('position.dca_schedule', ['maxCount', 'capitalCap', 'perOrderSizing', 'triggerMode', 'exitRule'], [
    DCA_SCHEDULE_EXIT_RULE_OPEN_SLOT,
  ], dcaScheduleSubstrate([DCA_SCHEDULE_EXIT_RULE_OPEN_SLOT])),
  unsupported('market.trend', 'trigger', '市场趋势旧别名', 'market_state_alias_public_beta_unsupported', 'market.trend 是旧状态别名，当前投影仅支持 trend.direction。'),
  unsupported('market.range', 'trigger', '震荡区间旧别名', 'market_state_alias_public_beta_unsupported', 'market.range 是旧状态别名，当前投影仅支持 market.regime。'),
  unsupported('indicator.above', 'trigger', '指标静态高于条件', 'indicator_static_compare_public_beta_unsupported', '指标静态高于条件当前公测暂未支持生成和回测。'),
  unsupported('indicator.below', 'trigger', '指标静态低于条件', 'indicator_static_compare_public_beta_unsupported', '指标静态低于条件当前公测暂未支持生成和回测。'),
  unsupported('price.previous_extrema', 'trigger', '前高/前低突破', 'previous_extrema_public_beta_unsupported', '前高/前低结构识别当前公测暂未支持生成和回测。'),
  unsupported('volume.spike', 'trigger', '成交量放大', 'volume_condition_public_beta_unsupported', '成交量条件当前公测暂未支持生成和回测。'),
  unsupported('volume.threshold', 'trigger', '成交量阈值', 'volume_condition_public_beta_unsupported', '成交量条件当前公测暂未支持生成和回测。'),
  unsupported('volatility.atr_threshold', 'trigger', 'ATR 波动率阈值', 'atr_condition_public_beta_unsupported', 'ATR 条件当前公测暂未支持生成和回测。'),
  unsupported('risk.atr_stop', 'risk', 'ATR 动态止损', 'atr_stop_public_beta_unsupported', 'ATR 动态止损当前公测暂未支持生成和回测。'),
  unsupported('risk.partial_take_profit', 'risk', '分批止盈', 'partial_take_profit_public_beta_unsupported', '多档分批止盈当前公测暂未支持生成和回测。'),
  unsupported('position.leverage', 'position', '策略杠杆声明', 'leverage_contract_public_beta_unsupported', '策略内声明杠杆当前公测暂未支持生成和回测。'),
  unsupported('position.margin_mode', 'position', '逐仓/全仓声明', 'margin_mode_public_beta_unsupported', '策略内切换逐仓/全仓当前公测暂未支持生成和回测。'),
  unsupported('grid.dynamic_grid', 'trigger', '动态网格', 'dynamic_grid_public_beta_unsupported', '动态网格当前公测暂未支持生成和回测。'),
  unsupported('strategy.time_window', 'trigger', '交易时间窗口', 'time_window_public_beta_unsupported', '交易时间窗口当前公测暂未支持生成和回测。'),
  unsupported('strategy.multi_timeframe', 'trigger', '多周期条件', 'multi_timeframe_public_beta_unsupported', '多周期条件当前公测暂未支持生成和回测。'),
  unsupported('indicator.divergence', 'trigger', '指标背离', 'divergence_public_beta_unsupported', '指标背离当前公测暂未支持生成和回测。'),
  unsupported('price.pattern', 'trigger', '图形形态', 'chart_pattern_public_beta_unsupported', '图形形态识别当前公测暂未支持生成和回测。'),
  unsupported('action.pause_trading', 'action', '暂停交易', 'pause_trading_public_beta_unsupported', '暂停交易动作当前公测暂未支持生成和回测。'),
]

@Injectable()
export class SemanticAtomRegistryService {
  private readonly atoms = new Map(ATOMS.map(atom => [atom.key, atom]))

  get(key: string): SemanticRegisteredAtomDefinition {
    const atom = this.atoms.get(key)
    if (!atom) {
      throw new Error(`semantic_atom_not_registered:${key}`)
    }
    return cloneAtom(atom)
  }

  resolve(key: string, params?: Record<string, unknown>): SemanticRegisteredAtomDefinition | UnknownSemanticAtomDefinition {
    if (key === 'risk.partial_take_profit') {
      return resolvePartialTakeProfitAtom(params ?? {})
    }
    const atom = this.atoms.get(key)
    return atom ? cloneAtom(atom) : {
      key,
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    }
  }

  list(): SemanticRegisteredAtomDefinition[] {
    return [...this.atoms.values()].map(atom => cloneAtom(atom))
  }
}

function executableTrigger(key: string, requiredParams: string[]): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'trigger',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate: baseExecutableSubstrate(),
  }
}

function executableAction(key: string): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'action',
    supportStatus: 'supported_executable',
    requiredParams: [],
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate: baseExecutableSubstrate(),
  }
}

function executableRisk(key: string, requiredParams: string[]): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
    contractSubstrate: baseExecutableSubstrate(),
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
