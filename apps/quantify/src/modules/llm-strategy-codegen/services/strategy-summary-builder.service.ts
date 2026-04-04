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

    return {
      strategyType: this.resolveStrategyType(indicators),
      indicators,
      entryRule: this.resolveEntryRuleTag(spec.entries.map(item => item.trigger).join('\n'), indicators),
      exitRule: this.resolveExitRuleTag(spec.exits.map(item => item.trigger).join('\n'), indicators),
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
    if ((indicators.includes('sma') || indicators.includes('ema')) && /金叉|上穿/i.test(text)) {
      return 'ma.golden_cross'
    }
    return 'custom'
  }

  private resolveExitRuleTag(text: string, indicators: StrategySummaryIndicator[]): string {
    if (!text.trim()) return 'custom'
    if (indicators.includes('bollingerBands')) {
      if (/中轨|middle|ma20/i.test(text)) return 'bollinger.middle_revert'
      return 'bollinger.exit'
    }
    if ((indicators.includes('sma') || indicators.includes('ema')) && /死叉|下穿/i.test(text)) {
      return 'ma.death_cross'
    }
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
    if ((indicators.includes('sma') || indicators.includes('ema')) && profile.actions.some(item => item.startsWith('OPEN_'))) {
      return 'ma.golden_cross'
    }
    return 'custom'
  }

  private resolveScriptExitRuleTag(
    profile: StrategySemanticProfile,
    indicators: StrategySummaryIndicator[],
  ): string {
    if (profile.ruleMappings.some(item => item.key === 'bollinger.middle_revert')) {
      return 'bollinger.middle_revert'
    }
    if ((indicators.includes('sma') || indicators.includes('ema')) && profile.actions.some(item => item.startsWith('CLOSE_'))) {
      return 'ma.death_cross'
    }
    return 'custom'
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
