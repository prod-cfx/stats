import type { CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { StrategySemanticProfile } from '../types/strategy-semantic-profile'
import type { StrategySummary, StrategySummaryIndicator } from '../types/strategy-summary'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { ScriptProfileExtractorService } from './script-profile-extractor.service'

interface ChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

const ENTRY_ACTIONS = new Set(['OPEN_LONG', 'OPEN_SHORT'])
const EXIT_ACTIONS = new Set(['CLOSE_LONG', 'CLOSE_SHORT', 'ADJUST_POSITION'])
const ENTRY_RULE_KEYS = new Set([
  'grid.range_rebalance',
  'breakout.channel_high_break',
  'breakout.channel_low_break',
  'risk.cooldown_bars',
])
const EXIT_RULE_KEYS = new Set([
  'grid.range_rebalance',
  'risk.take_profit_pct',
  'risk.trailing_stop_pct',
  'risk.time_stop_bars',
])

@Injectable()
export class StrategySummaryBuilderService {
  constructor(private readonly scriptProfileExtractor: ScriptProfileExtractorService) {}

  buildUserIntentSummary(input: {
    checklist: ChecklistSnapshot
    message?: string
  }): StrategySummary {
    const normalized = this.normalizeChecklist(input.checklist)
    const text = [
      normalized.entryRules.join('\n'),
      normalized.exitRules.join('\n'),
      input.message ?? '',
    ].join('\n')
    const indicators = this.detectIndicatorsFromText(text)
    const strategyType = this.resolveStrategyType(indicators)

    return {
      strategyType,
      indicators,
      entryRule: this.resolveEntryRuleTag(normalized.entryRules.join('\n'), indicators),
      exitRule: this.resolveExitRuleTag(normalized.exitRules.join('\n'), indicators),
      market: this.buildMarket({
        symbol: normalized.symbols[0],
        timeframe: normalized.timeframes[0],
        marketType: this.normalizeMarketType(normalized.riskRules.marketType),
      }),
      sizing: typeof normalized.riskRules.positionPct === 'number' && Number.isFinite(normalized.riskRules.positionPct)
        ? { mode: 'RATIO', evidence: 'explicit' }
        : null,
    }
  }

  buildStrategySummary(spec: CanonicalStrategySpec): StrategySummary {
    const indicators = this.normalizeIndicators(
      spec.indicators
        .map(item => item.kind)
        .filter((item): item is Exclude<typeof item, 'custom'> => item !== 'custom'),
    )

    const specRuleText = this.resolveSpecRuleText(spec)

    return {
      strategyType: this.resolveStrategyType(indicators),
      indicators,
      entryRule: this.resolveEntryRuleTag(specRuleText.entry, indicators),
      exitRule: this.resolveExitRuleTag(specRuleText.exit, indicators),
      market: this.buildMarket({
        symbol: this.normalizeSymbol(spec.market.symbol),
        timeframe: this.normalizeTimeframe(spec.market.timeframe),
        marketType: this.normalizeMarketType(spec.market.marketType),
      }),
      sizing: spec.sizing
        ? { mode: spec.sizing.mode, evidence: 'explicit' }
        : null,
    }
  }

  private resolveSpecRuleText(spec: CanonicalStrategySpec): {
    entry: string
    exit: string
  } {
    if (spec.version === 2) {
      const entry = spec.rules
        .filter(rule => rule.phase === 'entry')
        .map(rule => `${rule.condition.kind === 'atom' ? rule.condition.key : rule.id} ${rule.actions.map(action => action.type).join(' ')}`)
        .join('\n')
      const exit = spec.rules
        .filter(rule => rule.phase === 'exit')
        .map(rule => `${rule.condition.kind === 'atom' ? rule.condition.key : rule.id} ${rule.actions.map(action => action.type).join(' ')}`)
        .join('\n')
      return { entry, exit }
    }

    return {
      entry: spec.entries.map(item => item.trigger).join('\n'),
      exit: spec.exits.map(item => item.trigger).join('\n'),
    }
  }

  buildScriptSummary(input: {
    scriptCode?: string
    scriptProfile?: StrategySemanticProfile
  }): StrategySummary {
    const profile = input.scriptProfile
      ?? (input.scriptCode ? this.scriptProfileExtractor.extract(input.scriptCode) : null)
    if (!profile) {
      return this.buildEmptySummary()
    }

    const indicators = this.normalizeIndicators(
      profile.indicators
        .map(item => item.kind)
        .filter((item): item is Exclude<typeof item, 'custom'> => item !== 'custom'),
    )
    const entryRule = this.resolveScriptEntryRuleTag(profile, indicators)
    const exitRule = this.resolveScriptExitRuleTag(profile, indicators)

    return {
      strategyType: this.resolveStrategyType(indicators),
      indicators,
      entryRule,
      exitRule,
      market: {},
      sizing: profile.sizing
        ? {
          mode: profile.sizing.mode,
          evidence: profile.sizing.source === 'literal' || profile.sizing.source === 'positionPct_normalized'
            ? 'explicit'
            : 'unresolved',
        }
        : null,
    }
  }

  private buildEmptySummary(): StrategySummary {
    return {
      strategyType: 'custom',
      indicators: [],
      entryRule: 'custom',
      exitRule: 'custom',
      market: {},
      sizing: null,
    }
  }

  private normalizeChecklist(checklist: ChecklistSnapshot): {
    symbols: string[]
    timeframes: string[]
    entryRules: string[]
    exitRules: string[]
    riskRules: Record<string, unknown>
  } {
    const normalizeStringArray = (value: unknown, mapper?: (item: string) => string): string[] => {
      if (!Array.isArray(value)) return []
      return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => mapper ? mapper(item) : item)
    }

    return {
      symbols: normalizeStringArray(checklist.symbols, item => this.normalizeSymbol(item)),
      timeframes: normalizeStringArray(checklist.timeframes, item => this.normalizeTimeframe(item)),
      entryRules: normalizeStringArray(checklist.entryRules),
      exitRules: normalizeStringArray(checklist.exitRules),
      riskRules: checklist.riskRules && typeof checklist.riskRules === 'object' && !Array.isArray(checklist.riskRules)
        ? checklist.riskRules as Record<string, unknown>
        : {},
    }
  }

  private normalizeIndicators(indicators: StrategySummaryIndicator[]): StrategySummaryIndicator[] {
    return Array.from(new Set(indicators))
  }

  private detectIndicatorsFromText(text: string): StrategySummaryIndicator[] {
    const normalized = text.toLowerCase()
    const indicators: StrategySummaryIndicator[] = []
    const push = (indicator: StrategySummaryIndicator) => {
      if (!indicators.includes(indicator)) indicators.push(indicator)
    }

    if (/布林|bollinger|bbands/i.test(text)) push('bollingerBands')
    if (/\bsma\b|简单均线|移动平均|moving average/i.test(text)) push('sma')
    if (/\bema\b|指数均线/i.test(text)) push('ema')
    if (/\brsi\b/i.test(text)) push('rsi')
    if (/\batr\b/i.test(text)) push('atr')
    if (/\bmacd\b/i.test(text)) push('macd')

    if (
      normalized.includes('均线')
      && !normalized.includes('不要均线')
      && !normalized.includes('非均线')
      && !normalized.includes('布林带')
      && !indicators.includes('sma')
    ) {
      push('sma')
    }

    return indicators
  }

  private resolveStrategyType(indicators: StrategySummaryIndicator[]): StrategySummary['strategyType'] {
    if (indicators.includes('bollingerBands')) return 'bollinger'
    if (indicators.includes('sma') || indicators.includes('ema')) return 'movingAverage'
    if (indicators.includes('rsi') || indicators.includes('macd')) return 'momentum'
    if (indicators.includes('atr')) return 'volatility'
    return 'custom'
  }

  private resolveEntryRuleTag(text: string, indicators: StrategySummaryIndicator[]): string {
    if (!text.trim()) return 'custom'
    if (indicators.includes('bollingerBands')) {
      if (/上轨|upper/i.test(text) && /空|short/i.test(text)) return 'bollinger.upper_break_short'
      if (/下轨|lower/i.test(text) && /多|long/i.test(text)) return 'bollinger.lower_break_long'
      return 'bollinger.entry'
    }
    if (indicators.includes('sma') || indicators.includes('ema')) {
      const maRule = this.resolveMovingAverageRuleTagFromText(text)
      if (maRule) return maRule
    }
    if (indicators.includes('rsi') || indicators.includes('macd')) {
      const momentumRule = this.resolveMomentumRuleTagFromText(text)
      if (momentumRule) return momentumRule
    }
    const advancedRule = this.resolveAdvancedRuleTagFromText(text, 'entry')
    if (advancedRule) return advancedRule
    return 'custom'
  }

  private resolveExitRuleTag(text: string, indicators: StrategySummaryIndicator[]): string {
    if (!text.trim()) return 'custom'
    if (indicators.includes('bollingerBands')) {
      if (/中轨|middle|ma20/i.test(text)) return 'bollinger.middle_revert'
      return 'bollinger.exit'
    }
    if (indicators.includes('sma') || indicators.includes('ema')) {
      const maRule = this.resolveMovingAverageRuleTagFromText(text)
      if (maRule) return maRule
    }
    if (indicators.includes('rsi') || indicators.includes('macd')) {
      const momentumRule = this.resolveMomentumRuleTagFromText(text)
      if (momentumRule) return momentumRule
    }
    const advancedRule = this.resolveAdvancedRuleTagFromText(text, 'exit')
    if (advancedRule) return advancedRule
    return 'custom'
  }

  private resolveScriptEntryRuleTag(
    profile: StrategySemanticProfile,
    indicators: StrategySummaryIndicator[],
  ): string {
    const upper = profile.ruleMappings.find(item => item.key === 'bollinger.upper_break')
    if (upper?.action === 'OPEN_SHORT') return 'bollinger.upper_break_short'
    const lower = profile.ruleMappings.find(item => item.key === 'bollinger.lower_break')
    if (lower?.action === 'OPEN_LONG') return 'bollinger.lower_break_long'
    if (indicators.includes('sma') || indicators.includes('ema')) {
      return this.resolveMovingAverageRuleTagFromMappings(profile, ENTRY_ACTIONS)
    }
    if (indicators.includes('rsi') || indicators.includes('macd')) {
      return this.resolveMomentumRuleTagFromMappings(profile, ENTRY_ACTIONS)
    }
    const advancedRule = this.resolveAdvancedRuleTagFromMappings(profile, ENTRY_ACTIONS)
    if (advancedRule) return advancedRule
    return 'custom'
  }

  private resolveScriptExitRuleTag(
    profile: StrategySemanticProfile,
    indicators: StrategySummaryIndicator[],
  ): string {
    if (profile.ruleMappings.some(item => item.key === 'bollinger.middle_revert')) {
      return 'bollinger.middle_revert'
    }
    if (indicators.includes('sma') || indicators.includes('ema')) {
      return this.resolveMovingAverageRuleTagFromMappings(profile, EXIT_ACTIONS)
    }
    if (indicators.includes('rsi') || indicators.includes('macd')) {
      return this.resolveMomentumRuleTagFromMappings(profile, EXIT_ACTIONS)
    }
    const advancedRule = this.resolveAdvancedRuleTagFromMappings(profile, EXIT_ACTIONS)
    if (advancedRule) return advancedRule
    return 'custom'
  }

  private resolveMovingAverageRuleTagFromText(text: string): 'ma.golden_cross' | 'ma.death_cross' | null {
    const hasGoldenCross = /金叉|上穿|golden[_\s]?cross|ma\.golden_cross/i.test(text)
    const hasDeathCross = /死叉|下穿|death[_\s]?cross|ma\.death_cross/i.test(text)

    if (hasGoldenCross && hasDeathCross) return null
    if (hasGoldenCross) return 'ma.golden_cross'
    if (hasDeathCross) return 'ma.death_cross'
    return null
  }

  private resolveMomentumRuleTagFromText(
    text: string,
  ): 'rsi.threshold_lte' | 'rsi.threshold_gte' | 'rsi.cross_over' | 'rsi.cross_under' | 'macd.golden_cross' | 'macd.death_cross' | null {
    if (/\bmacd\b|指数平滑异同/iu.test(text)) {
      if (/金叉|上穿/u.test(text)) return 'macd.golden_cross'
      if (/死叉|下穿/u.test(text)) return 'macd.death_cross'
    }

    if (/\brsi\b|相对强弱|超买|超卖/iu.test(text)) {
      if (/上穿|突破/u.test(text)) return 'rsi.cross_over'
      if (/下穿|跌破/u.test(text)) return 'rsi.cross_under'
      if (/<=|＜=|小于等于|低于|小于|超卖|低位/u.test(text)) return 'rsi.threshold_lte'
      if (/>=|＞=|大于等于|高于|大于|超买|高位/u.test(text)) return 'rsi.threshold_gte'
    }

    return null
  }

  private resolveAdvancedRuleTagFromText(
    text: string,
    phase: 'entry' | 'exit',
  ): 'grid.range_rebalance' | 'breakout.channel_high_break' | 'breakout.channel_low_break' | 'risk.take_profit_pct' | 'risk.trailing_stop_pct' | 'risk.cooldown_bars' | 'risk.time_stop_bars' | null {
    if (/网格/u.test(text) || text.includes('grid.range_rebalance')) {
      return 'grid.range_rebalance'
    }

    if (
      phase === 'entry'
      && (
        text.includes('breakout.channel_high_break')
        || (
          (/\bhighest(?:high)?\b/i.test(text) || /通道上轨|通道上沿|前高|关键阻力|阻力位|唐奇安.*上轨|donchian.*upper|breakout/i.test(text))
          && (/>=|>|上穿|突破|breakout/i.test(text))
        )
      )
    ) {
      return 'breakout.channel_high_break'
    }

    if (
      phase === 'entry'
      && (
        text.includes('breakout.channel_low_break')
        || (
          (/\blowest(?:low)?\b/i.test(text) || /通道下轨|通道下沿|前低|关键支撑|支撑位|唐奇安.*下轨|donchian.*lower|breakdown/i.test(text))
          && (/<=|<|下穿|跌破|breakdown/i.test(text))
        )
      )
    ) {
      return 'breakout.channel_low_break'
    }

    if (phase === 'entry' && (text.includes('risk.cooldown_bars') || /冷却|cooldown/i.test(text))) {
      return 'risk.cooldown_bars'
    }

    if (phase === 'exit' && (text.includes('risk.take_profit_pct') || /止盈|take[_\s-]?profit/i.test(text))) {
      return 'risk.take_profit_pct'
    }

    if (phase === 'exit' && (text.includes('risk.trailing_stop_pct') || /移动止损|trailing[_\s-]?stop/i.test(text))) {
      return 'risk.trailing_stop_pct'
    }

    if (phase === 'exit' && (text.includes('risk.time_stop_bars') || /time[_\s-]?stop/i.test(text) || /持仓.{0,12}(?:bar|k|根)/iu.test(text))) {
      return 'risk.time_stop_bars'
    }

    return null
  }

  private resolveMovingAverageRuleTagFromMappings(
    profile: StrategySemanticProfile,
    actionSet: Set<string>,
  ): string {
    const matchedKeys = Array.from(new Set(
      profile.ruleMappings
        .filter(item => actionSet.has(item.action))
        .map(item => item.key)
        .filter((key): key is 'ma.golden_cross' | 'ma.death_cross' =>
          key === 'ma.golden_cross' || key === 'ma.death_cross'),
    ))

    return matchedKeys.length === 1 ? matchedKeys[0] : 'custom'
  }

  private resolveMomentumRuleTagFromMappings(
    profile: StrategySemanticProfile,
    actionSet: Set<string>,
  ): string {
    const matchedKeys = Array.from(new Set(
      profile.ruleMappings
        .filter(item => actionSet.has(item.action))
        .map(item => item.key)
        .filter((key): key is 'rsi.threshold_lte' | 'rsi.threshold_gte' | 'rsi.cross_over' | 'rsi.cross_under' | 'macd.golden_cross' | 'macd.death_cross' =>
          key === 'rsi.threshold_lte'
          || key === 'rsi.threshold_gte'
          || key === 'rsi.cross_over'
          || key === 'rsi.cross_under'
          || key === 'macd.golden_cross'
          || key === 'macd.death_cross'),
    ))

    return matchedKeys.length === 1 ? matchedKeys[0] : 'custom'
  }

  private resolveAdvancedRuleTagFromMappings(
    profile: StrategySemanticProfile,
    actionSet: Set<string>,
  ): string | null {
    const allowedKeys = actionSet === ENTRY_ACTIONS ? ENTRY_RULE_KEYS : EXIT_RULE_KEYS
    const matchedKeys = Array.from(new Set(
      profile.ruleMappings
        .filter(item => actionSet.has(item.action) && allowedKeys.has(item.key))
        .map(item => item.key),
    ))

    return matchedKeys.length === 1 ? matchedKeys[0] : null
  }

  private normalizeSymbol(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().toUpperCase()
    return normalized || undefined
  }

  private normalizeTimeframe(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized || undefined
  }

  private normalizeMarketType(value: unknown): 'spot' | 'perp' | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().toLowerCase()
    if (normalized === 'spot' || normalized === 'perp') return normalized
    return undefined
  }

  private buildMarket(input: {
    symbol?: string
    timeframe?: string
    marketType?: 'spot' | 'perp'
  }): StrategySummary['market'] {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as StrategySummary['market']
  }
}
