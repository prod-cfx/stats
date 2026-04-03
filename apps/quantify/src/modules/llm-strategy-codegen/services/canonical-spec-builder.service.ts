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
    if (indicators.length === 0 && /均线|\bsma\b/i.test(ruleTexts)) {
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
    })

    const exits: RuleSpec[] = []
    exitTexts.forEach((rule, index) => {
      if (/中轨|ma20|均线20|middle/i.test(rule)) {
        exits.push({ id: `exit-${index + 1}`, trigger: rule, action: 'ADJUST_POSITION' })
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

    const rawPositionPct = typeof riskRules.positionPct === 'number' ? riskRules.positionPct : 10
    const ratioValue = rawPositionPct > 1 ? rawPositionPct / 100 : rawPositionPct

    return {
      version: 1,
      market: {
        exchange: this.normalizeExchange(riskRules.exchange),
        symbol: symbols[0] ? String(symbols[0]).trim().toUpperCase() : 'BTCUSDT',
        marketType: this.normalizeMarketType(riskRules.marketType),
        timeframe: timeframes[0] ? String(timeframes[0]).trim() : '15m',
      },
      indicators,
      entries,
      exits,
      riskRules: normalizedRiskRules,
      sizing: {
        mode: 'RATIO',
        value: Number(ratioValue.toFixed(4)),
      },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        primary: [timeframes[0] ? String(timeframes[0]).trim() : '15m'],
      },
    }
  }

  private normalizeExchange(value: unknown): CanonicalStrategySpec['market']['exchange'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (normalized === 'okx' || normalized === 'hyperliquid') {
      return normalized
    }
    return 'binance'
  }

  private normalizeMarketType(value: unknown): CanonicalStrategySpec['market']['marketType'] {
    return typeof value === 'string' && value.trim().toLowerCase() === 'perp' ? 'perp' : 'spot'
  }
}
