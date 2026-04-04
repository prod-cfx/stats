import type { CanonicalStrategySpec, RiskRuleSpec, RuleSpec } from '../types/canonical-strategy-spec'
import { Injectable } from '@nestjs/common'

interface ChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

@Injectable()
export class CanonicalSpecBuilderService {
  build(checklist: ChecklistSnapshot): CanonicalStrategySpec {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const timeframes = Array.isArray(checklist.timeframes) ? checklist.timeframes : []
    const entryRules = Array.isArray(checklist.entryRules) ? checklist.entryRules : []
    const exitRules = Array.isArray(checklist.exitRules) ? checklist.exitRules : []
    const riskRules = checklist.riskRules && typeof checklist.riskRules === 'object'
      ? checklist.riskRules as Record<string, unknown>
      : {}

    const entryTexts = entryRules.map(item => String(item))
    const exitTexts = exitRules.map(item => String(item))
    const ruleTexts = [
      ...entryTexts,
      ...exitTexts,
      ...Object.values(riskRules).map(item => String(item)),
    ].join('\n')

    const indicators: CanonicalStrategySpec['indicators'] = []
    const pushIndicator = (indicator: CanonicalStrategySpec['indicators'][number]) => {
      if (indicators.some(item => item.kind === indicator.kind)) return
      indicators.push(indicator)
    }

    if (/布林|bollinger/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'bollingerBands',
        params: { period: 20, stdDev: 2 },
      })
    }
    if (/rsi/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'rsi',
        params: { period: 14 },
      })
    }
    if (/\batr\b/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'atr',
        params: { period: 14 },
      })
    }
    if (/\bmacd\b/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'macd',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      })
    }
    if (/\bema\b|指数均线/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'ema',
        params: { period: 20 },
      })
    }
    if (/\bsma\b|简单均线|均线|moving average/i.test(ruleTexts)) {
      pushIndicator({
        kind: 'sma',
        params: { period: 20 },
      })
    }
    const entries: RuleSpec[] = []
    entryTexts.forEach((rule, index) => {
      if (/上轨|upper/i.test(rule) && /做空|空单|short/i.test(rule)) {
        entries.push({ id: `entry-${index + 1}`, trigger: rule, action: 'OPEN_SHORT' })
      }
      if (/下轨|lower/i.test(rule) && /做多|多单|long/i.test(rule)) {
        entries.push({ id: `entry-${index + 1}`, trigger: rule, action: 'OPEN_LONG' })
      }
      if (/(金叉|上穿|死叉|下穿)/i.test(rule) && /均线|\bma\b|\bsma\b|\bema\b/i.test(rule)) {
        const action = /做空|空单|short/i.test(rule) ? 'OPEN_SHORT' : 'OPEN_LONG'
        entries.push({ id: `entry-${index + 1}`, trigger: rule, action })
      }
    })

    const exits: RuleSpec[] = []
    exitTexts.forEach((rule, index) => {
      if (/中轨|ma20|均线20|middle/i.test(rule)) {
        exits.push({ id: `exit-${index + 1}`, trigger: rule, action: 'ADJUST_POSITION' })
      }
      if (/(金叉|上穿|死叉|下穿)/i.test(rule) && /均线|\bma\b|\bsma\b|\bema\b/i.test(rule)) {
        exits.push({
          id: `exit-${index + 1}`,
          trigger: rule,
          action: this.resolveExitAction(rule),
        })
      }
    })

    const normalizedRiskRules: RiskRuleSpec[] = []
    const stopLossPct = typeof riskRules.stopLossPct === 'number'
      ? riskRules.stopLossPct
      : typeof riskRules.stopLoss === 'number'
        ? riskRules.stopLoss
        : null
    if (typeof stopLossPct === 'number' && Number.isFinite(stopLossPct) && stopLossPct > 0) {
      normalizedRiskRules.push({
        id: 'risk-stop-loss',
        trigger: `lossPct >= ${(stopLossPct / 100).toFixed(4)}`,
        effect: 'FORCE_STOP',
      })
    }
    const earlyStopText = typeof riskRules.earlyStop === 'string' ? riskRules.earlyStop : ''
    if (/连续\s*3|3\s*根/.test(earlyStopText) && /轨外|outside/.test(earlyStopText)) {
      normalizedRiskRules.push({
        id: 'risk-outside-band-3-bars',
        trigger: earlyStopText,
        effect: 'REDUCE_POSITION',
      })
    }

    const market: CanonicalStrategySpec['market'] = {}
    const exchange = this.normalizeExchange(riskRules.exchange)
    if (exchange) {
      market.exchange = exchange
    }
    const symbol = symbols[0] ? String(symbols[0]).trim().toUpperCase() : ''
    if (symbol) {
      market.symbol = symbol
    }
    const marketType = this.normalizeMarketType(riskRules.marketType)
    if (marketType) {
      market.marketType = marketType
    }
    const timeframe = timeframes[0] ? String(timeframes[0]).trim() : ''
    if (timeframe) {
      market.timeframe = timeframe
    }
    const rawPositionPct = typeof riskRules.positionPct === 'number' ? riskRules.positionPct : null
    const sizing = typeof rawPositionPct === 'number' && Number.isFinite(rawPositionPct) && rawPositionPct > 0
      ? {
        mode: 'RATIO' as const,
        value: Number((rawPositionPct > 1 ? rawPositionPct / 100 : rawPositionPct).toFixed(4)),
      }
      : null

    return {
      version: 1,
      market,
      indicators,
      entries,
      exits,
      riskRules: normalizedRiskRules,
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        primary: timeframe ? [timeframe] : [],
      },
    }
  }

  private normalizeExchange(value: unknown): CanonicalStrategySpec['market']['exchange'] | undefined {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (normalized === 'okx' || normalized === 'hyperliquid') {
      return normalized
    }
    if (normalized === 'binance') {
      return 'binance'
    }
    return undefined
  }

  private normalizeMarketType(value: unknown): CanonicalStrategySpec['market']['marketType'] | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim().toLowerCase()
    if (normalized === 'perp' || normalized === 'spot') {
      return normalized
    }
    return undefined
  }

  private resolveExitAction(rule: string): RuleSpec['action'] {
    if (/平空|close\s+short/i.test(rule)) {
      return 'CLOSE_SHORT'
    }
    if (/平多|close\s+long/i.test(rule)) {
      return 'CLOSE_LONG'
    }
    return 'ADJUST_POSITION'
  }
}
