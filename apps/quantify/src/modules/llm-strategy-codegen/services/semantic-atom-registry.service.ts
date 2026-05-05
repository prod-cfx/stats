import { Injectable } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type {
  SemanticAtomDefinition,
  SemanticAtomReplacementStrategy,
} from '../types/semantic-atom-support'

type UnknownSemanticAtomDefinition = Pick<SemanticAtomDefinition, 'category' | 'key' | 'supportStatus'>

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
  strategyKey: 'price_breakout_with_fixed_risk',
  description: 'MA20 上穿 MA50 开多，MA20 下穿 MA50 平仓，5% 止损，10% 止盈，单笔 10% 仓位。',
  patch: DEFAULT_REPLACEMENT_PATCH,
}

const ATOMS: SemanticAtomDefinition[] = [
  executableTrigger('execution.on_start', ['timing', 'orderType', 'occurrence']),
  executableTrigger('condition.expression', []),
  executableTrigger('semantic.missing_entry_atom', []),
  executableTrigger('semantic.missing_exit_atom', []),
  executableTrigger('price.percent_change', ['valuePct']),
  executableTrigger('price.breakout_up', ['reference']),
  executableTrigger('price.breakout_down', ['reference']),
  executableTrigger('price.range_position_lte', ['lookbackBars', 'thresholdPct']),
  executableTrigger('price.range_position_gte', ['lookbackBars', 'thresholdPct']),
  executableTrigger('price.detect.indicator_boundary', ['indicator', 'boundaryRole']),
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
  executableAction('reduce_long'),
  executableAction('reduce_short'),
  executableAction('action.grid_ladder'),
  executableAction('place_limit_grid'),
  executableRisk('risk.condition_expression', []),
  executableRisk('risk.boundary_guard', []),
  executableRisk('risk.protective_exit', []),
  executableRisk('risk.stop_loss', []),
  executableRisk('risk.take_profit', []),
  executableRisk('risk.stop_loss_pct', ['valuePct']),
  executableRisk('risk.take_profit_pct', ['valuePct']),
  executableRisk('risk.trailing_stop_pct', ['valuePct']),
  executableRisk('risk.max_drawdown_pct', ['valuePct']),
  executableRisk('risk.max_single_loss_pct', ['valuePct']),
  executableRisk('risk.cooldown_bars', ['bars']),
  executablePosition('position.fixed_pct', ['value']),
  executablePosition('position.fixed_notional', ['value', 'asset']),
  executablePosition('position.fixed_quantity', ['value', 'asset']),
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
  unsupported('action.add_position', 'action', '加仓', 'scale_in_public_beta_unsupported', '复杂加仓当前公测暂未支持生成和回测。'),
  unsupported('action.reverse_position', 'action', '反手', 'reverse_position_public_beta_unsupported', '反手交易当前公测暂未支持生成和回测。'),
  unsupported('position.dca_schedule', 'position', 'DCA 定投/补仓', 'dca_public_beta_unsupported', 'DCA 定投/补仓当前公测暂未支持生成和回测。'),
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

  get(key: string): SemanticAtomDefinition {
    const atom = this.atoms.get(key)
    if (!atom) {
      throw new Error(`semantic_atom_not_registered:${key}`)
    }
    return atom
  }

  resolve(key: string): SemanticAtomDefinition | UnknownSemanticAtomDefinition {
    return this.atoms.get(key) ?? {
      key,
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    }
  }

  list(): SemanticAtomDefinition[] {
    return [...this.atoms.values()]
  }
}

function executableTrigger(key: string, requiredParams: string[]): SemanticAtomDefinition {
  return {
    key,
    category: 'trigger',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
  }
}

function executableAction(key: string): SemanticAtomDefinition {
  return {
    key,
    category: 'action',
    supportStatus: 'supported_executable',
    requiredParams: [],
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
  }
}

function executableRisk(key: string, requiredParams: string[]): SemanticAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots: [],
  }
}

function executablePosition(key: string, requiredParams: string[]): SemanticAtomDefinition {
  return {
    key,
    category: 'position',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots: [],
  }
}

function unsupported(
  key: string,
  category: SemanticAtomDefinition['category'],
  displayName: string,
  reasonCode: string,
  publicReason: string,
): SemanticAtomDefinition {
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
