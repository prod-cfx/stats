import { Injectable } from '@nestjs/common'

import { getDisplayToken, listDisplayTokens } from '../nl-gateway/display-registry'

export interface RenderSemanticClarificationQuestionInput {
  slotKey: string
  fallback: string
}

export type ClarificationQuestionLocale = 'zh' | 'en'

export interface ClarificationQuestion {
  title: string
  question: string
  slotLabel: string
  examples: string[]
}

interface LocalizedClarificationCopy {
  zh: string
  en: string
  examples: {
    zh: string[]
    en: string[]
  }
}

export const SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY: Record<string, string> = {
  'contract.shape.price.level_set.density': '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
  'contract.shape.price.level_set.spacing_conflict': '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
  'contract.requirement.price.define.level_set': '请补充网格价格区间和网格数量或每格间距。',
  'trigger.percent_change.magnitude': '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
  'trigger.confirmation.rebound_definition': '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。',
  'trigger.confirmation.pullback_hold': '请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。',
  'risk.falling_knife_guard.definition': '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
  'position.sizing': '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
  'trigger.volume.relative_average.lookback_bars': '请确认放量对比的均量窗口，例如过去 20 根 K 线。',
  'trigger.volume.relative_average.multiplier': '请确认放量倍数，例如高于均量 1.5 倍。',
}

const SEMANTIC_BUSINESS_QUESTION_I18N_BY_SLOT_KEY: Record<string, LocalizedClarificationCopy> = {
  'contract.shape.price.level_set.density': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['contract.shape.price.level_set.density'],
    'Please confirm the grid count or spacing, for example 20 levels, 100 USDT per level, or 0.5% per level.',
    ['20 格', '每格 100 USDT', '每格 0.5%'],
    ['20 levels', '100 USDT per level', '0.5% per level'],
  ),
  'contract.shape.price.level_set.spacing_conflict': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['contract.shape.price.level_set.spacing_conflict'],
    'The grid count and spacing do not match the current price range. Please confirm whether to keep the grid count or the spacing.',
    ['保留网格数量', '保留每格间距'],
    ['keep the grid count', 'keep the spacing'],
  ),
  'contract.requirement.price.define.level_set': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['contract.requirement.price.define.level_set'],
    'Please provide the grid price range and either the grid count or the spacing between levels.',
    ['1000-1200 USDT，20 格', '1000-1200 USDT，每格 1%'],
    ['1000-1200 USDT with 20 levels', '1000-1200 USDT with 1% spacing'],
  ),
  'trigger.percent_change.magnitude': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['trigger.percent_change.magnitude'],
    'Please confirm the threshold for the large move, for example a drop of more than 5% in 4 hours or more than 8% over the last 20 candles.',
    ['4 小时跌幅超过 5%', '最近 20 根 K 线跌幅超过 8%'],
    ['drop of more than 5% in 4 hours', 'drop of more than 8% over the last 20 candles'],
  ),
  'trigger.confirmation.rebound_definition': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['trigger.confirmation.rebound_definition'],
    'Please confirm the rebound confirmation rule, for example reclaiming MA20, a 1% close-up move, or the next candle closing bullish.',
    ['重新站上 MA20', '收盘价上涨 1%', '下一根 K 线收阳'],
    ['reclaim MA20', 'close up 1%', 'next candle closes bullish'],
  ),
  'trigger.confirmation.pullback_hold': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['trigger.confirmation.pullback_hold'],
    'Please confirm how to judge that the pullback holds: should the close stay above the breakout level, or should the low stay above it?',
    ['收盘价不跌破突破位', '最低价不跌破突破位'],
    ['close stays above the breakout level', 'low stays above the breakout level'],
  ),
  'risk.falling_knife_guard.definition': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['risk.falling_knife_guard.definition'],
    'Please confirm the falling-knife guard, for example reclaiming MA20, the next candle closing bullish, or the decline stopping expansion.',
    ['反弹站上 MA20', '下一根 K 线收阳', '跌幅停止扩大'],
    ['rebound reclaims MA20', 'next candle closes bullish', 'the decline stops expanding'],
  ),
  'position.sizing': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['position.sizing'],
    'Please confirm the position size for each trade, for example 10%, 10 USDT, or 0.001 BTC.',
    ['10%', '10 USDT', '0.001 BTC'],
    ['10%', '10 USDT', '0.001 BTC'],
  ),
  'trigger.volume.relative_average.lookback_bars': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['trigger.volume.relative_average.lookback_bars'],
    'Please confirm the lookback window for average volume, for example the last 20 candles.',
    ['过去 20 根 K 线'],
    ['last 20 candles'],
  ),
  'trigger.volume.relative_average.multiplier': localizedCopy(
    SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY['trigger.volume.relative_average.multiplier'],
    'Please confirm the volume multiplier, for example 1.5 times above the average volume.',
    ['高于均量 1.5 倍'],
    ['1.5 times above average volume'],
  ),
}

const CLARIFICATION_SLOT_LABEL_OVERRIDES: Record<string, Record<ClarificationQuestionLocale, string>> = {
  'contract.shape.price.level_set.density': {
    zh: '网格数量或间距',
    en: 'grid count or spacing',
  },
  'contract.shape.price.level_set.spacing_conflict': {
    zh: '网格数量与间距冲突',
    en: 'grid count and spacing conflict',
  },
  'contract.requirement.price.define.level_set': {
    zh: '网格价格区间与档位',
    en: 'grid price range and levels',
  },
  'position.sizing': {
    zh: '单笔仓位大小',
    en: 'position size per trade',
  },
  'risk.falling_knife_guard.definition': {
    zh: '急跌保护判定方式',
    en: 'falling-knife guard rule',
  },
  'trigger.confirmation.pullback_hold': {
    zh: '回踩不破判定方式',
    en: 'pullback hold rule',
  },
  'trigger.confirmation.rebound_definition': {
    zh: '反弹确认条件',
    en: 'rebound confirmation rule',
  },
  'trigger.percent_change.magnitude': {
    zh: '涨跌幅阈值',
    en: 'percent-change threshold',
  },
  'trigger.volume.relative_average.lookback_bars': {
    zh: '均量窗口',
    en: 'average-volume lookback window',
  },
  'trigger.volume.relative_average.multiplier': {
    zh: '放量倍数',
    en: 'relative-volume multiplier',
  },
}

const DISPLAY_SLOT_EN_LABEL_BY_SLOT_KEY: Record<string, string> = {
  'volume.threshold.value': 'volume threshold',
  'volume.threshold.operator': 'volume comparison direction',
  'volume.threshold.metric': 'volume metric',
  'volatility.atr_threshold.period': 'ATR period',
  'volatility.atr_threshold.threshold': 'ATR threshold',
  'volatility.atr_threshold.thresholdUnit': 'ATR threshold unit',
  'volatility.atr_threshold.operator': 'ATR comparison direction',
  'strategy.time_window.timezone': 'trading timezone',
  'strategy.time_window.windows': 'allowed trading windows',
  'position.has_position.sideScope': 'existing-position side',
  'position.no_position.sideScope': 'no-position side',
  'position.dca_schedule.max_count': 'maximum DCA count',
  'position.dca_schedule.capital_cap': 'DCA capital cap',
  'position.dca_schedule.per_order_sizing': 'DCA size per order',
  'position.dca_schedule.trigger_mode': 'DCA trigger mode',
  'position.dca_schedule.exit_rule': 'DCA stop rule',
  'price.candle_pattern.pattern': 'candlestick pattern type',
  'price.candle_pattern.direction': 'candlestick pattern direction',
  'price.candle_pattern.minBars': 'minimum consecutive candles',
  'price.chart_pattern.pattern': 'chart pattern type',
  'price.chart_pattern.direction': 'chart pattern direction',
  'liquidity.sweep.direction': 'sweep reversal direction',
  'liquidity.sweep.reference': 'swept key level',
  'liquidity.sweep.reclaimBars': 'reclaim confirmation candles',
  'indicator.divergence.indicator': 'divergence indicator',
  'indicator.divergence.direction': 'divergence direction',
  'indicator.divergence.pivotWindow': 'divergence pivot window',
  'indicator.divergence.confirmationBars': 'divergence confirmation candles',
  'external.signal.provider': 'external signal provider',
  'external.signal.signalId': 'external signal subscription ID',
  'external.signal.secret': 'external signal verification secret',
  'orchestration.gate.regime.active_when': 'trend filter activation condition',
  'orchestration.portfolio_drawdown.threshold_pct': 'portfolio drawdown threshold percentage',
  'orchestration.program.fixed_grid_gated.gridParams': 'grid range, levels, and spacing',
  'orchestration.program.fixed_grid_gated.activeWhenRef': 'grid activation/deactivation condition reference',
  'orchestration.program.fixed_grid_gated.sizing': 'order size per grid level',
  'orchestration.gate.regime.effect_phase_mismatch': 'phase=entry only supports block_new_entries effect',
  'orchestration.gate.subStrategy.active_when': 'sub-strategy gate activation condition',
  'orchestration.gate.subStrategy.effect_phase_mismatch': 'phase=subStrategy only supports pause_substrategy or switch_substrategy',
  'orchestration.gate.subStrategy.scope_ref_unknown': 'gate references an undeclared sub-strategy scope',
  'orchestration.gate.subStrategy.switch_target_required': 'switch_substrategy gate must specify a target scope',
  'orchestration.gate.subStrategy.switch_target_self': 'switch target must differ from current sub-strategy',
  'orchestration.gate.unsupported_phase': 'phase=strategy is not supported for gates',
  'orchestration.scope.unsupported_kind': 'only scope.symbol / scope.leg / scope.timeframe / scope.dataSource / scope.subStrategy are supported',
  'orchestration.scope.symbol.symbols': 'symbol list',
  'orchestration.scope.symbol.primary_symbol': 'primary symbol',
  'orchestration.scope.symbol.symbols_overlap': 'symbols must not overlap across scopes',
  'orchestration.scope.symbol.primary_symbol_collision': 'primary symbol must be unique across scopes',
  'orchestration.scope.symbol.missing_binding': 'symbol scope binding',
  'orchestration.scope.timeframe.scope_kind': 'timeframe scope kind',
  'orchestration.scope.timeframe.unsupported_key': 'only scope.timeframe is supported',
  'orchestration.scope.timeframe.primary_timeframe': 'primary timeframe',
  'orchestration.scope.timeframe.required_timeframes': 'required timeframes',
  'orchestration.scope.timeframe.required_length': 'required timeframes count must be between 1 and 8',
  'orchestration.scope.timeframe.primary_granularity': 'primary timeframe must be strictly finer than all required timeframes',
  'orchestration.scope.timeframe.alignment_policy': 'timeframe alignment policy',
  'orchestration.scope.timeframe.duplicate_definition': 'timeframe scopes must not duplicate the (primary, required) tuple',
  'orchestration.scope.timeframe.missing_binding': 'timeframe scope binding',
  'orchestration.scope.dataSource.scope_kind': 'data source scope kind',
  'orchestration.scope.dataSource.role': 'data source role',
  'orchestration.scope.dataSource.feed_id': 'data source feed id',
  'orchestration.scope.dataSource.schema_ref': 'data source schema reference',
  'orchestration.scope.dataSource.feed_id_overlap': 'feed id must not repeat across data source scopes',
  'orchestration.scope.dataSource.primary_collision': 'at most one primary data source is allowed',
  'orchestration.scope.dataSource.missing_binding': 'data source scope binding',
  'orchestration.scope.subStrategy.scope_kind': 'sub-strategy scope kind',
  'orchestration.scope.subStrategy.substrategy_id': 'sub-strategy id',
  'orchestration.scope.subStrategy.position_handling': 'sub-strategy position handling on switch',
  'orchestration.scope.subStrategy.order_handling': 'sub-strategy order handling on switch',
  'orchestration.scope.subStrategy.id_collision': 'sub-strategy id must be unique across scopes',
  'orchestration.scope.subStrategy.missing_binding': 'sub-strategy scope binding',
  'orchestration.scope.leg.unsupported_kind': 'only scope.leg sub-kinds are supported',
  'orchestration.scope.leg.leg_scope_kind': 'leg scope kind',
  'orchestration.scope.leg.leg_id': 'leg id',
  'orchestration.scope.leg.direction': 'leg direction',
  'orchestration.scope.leg.instrument_ref': 'leg must reference an existing scope.symbol whose readiness is satisfied',
  'orchestration.scope.leg.leg_sizing.mode': 'leg sizing mode',
  'orchestration.scope.leg.leg_sizing.value': 'leg sizing value',
  'orchestration.scope.leg.paired_leg_id': 'fixed_ratio mode must specify pairedLegId',
  'orchestration.scope.leg.direction_collision': 'paired legs must have opposite directions',
  'orchestration.scope.leg.missing_binding': 'leg scope binding',
}

export interface ClarificationSlotI18nToken {
  slotKey: string
  zh: string
  en: string
}

export function renderSemanticClarificationQuestion(input: RenderSemanticClarificationQuestionInput): string {
  return SEMANTIC_BUSINESS_QUESTION_BY_SLOT_KEY[input.slotKey] ?? input.fallback
}

export function listClarificationSlotI18nTokens(): ClarificationSlotI18nToken[] {
  return listDisplayTokens('slot').map((token) => {
    const slotKey = removeSlotTokenPrefix(token.token)
    return {
      slotKey,
      zh: token.zh,
      en: DISPLAY_SLOT_EN_LABEL_BY_SLOT_KEY[slotKey] ?? '',
    }
  })
}

@Injectable()
export class SemanticClarificationQuestionRendererService {
  render(input: RenderSemanticClarificationQuestionInput): string {
    return renderSemanticClarificationQuestion(input)
  }

  renderStructured(
    input: RenderSemanticClarificationQuestionInput,
    locale: ClarificationQuestionLocale,
  ): ClarificationQuestion {
    const knownCopy = SEMANTIC_BUSINESS_QUESTION_I18N_BY_SLOT_KEY[input.slotKey]
    const slotLabel = resolvePublicSlotLabel(input.slotKey, locale)
    const fallback = sanitizeFallback(input.fallback, locale, slotLabel)

    return {
      title: locale === 'zh' ? '需要补充信息' : 'Clarification required',
      question: knownCopy?.[locale] ?? fallback,
      slotLabel,
      examples: knownCopy?.examples[locale] ?? [],
    }
  }
}

function localizedCopy(
  zh: string,
  en: string,
  zhExamples: string[],
  enExamples: string[],
): LocalizedClarificationCopy {
  return {
    zh,
    en,
    examples: {
      zh: zhExamples,
      en: enExamples,
    },
  }
}

function resolvePublicSlotLabel(
  slotKey: string,
  locale: ClarificationQuestionLocale,
): string {
  const override = CLARIFICATION_SLOT_LABEL_OVERRIDES[slotKey]?.[locale]
  if (override) return override

  if (locale === 'en') {
    return DISPLAY_SLOT_EN_LABEL_BY_SLOT_KEY[slotKey] ?? 'missing information'
  }

  const token = tryGetDisplaySlotToken(slotKey)
  return token?.zh ?? '缺失信息'
}

function tryGetDisplaySlotToken(slotKey: string): { zh: string } | null {
  try {
    return getDisplayToken(`slot.${slotKey}`)
  }
  catch {
    return null
  }
}

function sanitizeFallback(
  fallback: string,
  locale: ClarificationQuestionLocale,
  slotLabel: string,
): string {
  if (containsInternalKey(fallback)) {
    return locale === 'zh'
      ? `请补充${slotLabel}。`
      : `Please provide the ${slotLabel}.`
  }

  return fallback
}

function containsInternalKey(value: string): boolean {
  return /(?:^|[\s"'（(])(?:[a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*(?:$|[\s"'.,;:!?。,，；：！？）)])/iu.test(value)
}

function removeSlotTokenPrefix(token: string): string {
  return token.startsWith('slot.') ? token.slice('slot.'.length) : token
}
