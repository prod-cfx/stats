import type { BacktestReasonSource, BacktestRiskRules, Bar, PositionView } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'

export interface RiskEvaluationInput {
  symbol: string
  bar: Bar
  historyBars?: Bar[]
  position: PositionView
  riskRules?: BacktestRiskRules
}

export interface RiskDecision {
  type: 'CLOSE' | 'REDUCE'
  targetQty: number
  reason: string
  source: BacktestReasonSource
}

interface OutsideBandStreakState {
  direction: 1 | -1
  count: number
}

@Injectable()
export class RiskEvaluatorService {
  private readonly outsideBandStreakBySymbol = new Map<string, OutsideBandStreakState>()

  evaluate(input: RiskEvaluationInput): RiskDecision | undefined {
    const { position, riskRules, symbol } = input
    if (!riskRules || position.qty === 0 || !Number.isFinite(position.avgEntryPrice) || position.avgEntryPrice <= 0) {
      this.outsideBandStreakBySymbol.delete(symbol)
      return undefined
    }

    const floatingLossDecision = this.evaluateMaxFloatingLoss(input)
    if (floatingLossDecision) {
      this.outsideBandStreakBySymbol.delete(symbol)
      return floatingLossDecision
    }

    const outsideBandDecision = this.evaluateOutsideBand(input)
    if (outsideBandDecision) {
      this.outsideBandStreakBySymbol.delete(symbol)
      return outsideBandDecision
    }

    return undefined
  }

  reset() {
    this.outsideBandStreakBySymbol.clear()
  }

  private evaluateMaxFloatingLoss(input: RiskEvaluationInput): RiskDecision | undefined {
    const threshold = input.riskRules?.maxFloatingLossPct
    if (!Number.isFinite(threshold) || !threshold || threshold <= 0) return undefined

    const direction = Math.sign(input.position.qty)
    if (direction === 0) return undefined

    const pnlPct = direction > 0
      ? ((input.bar.close - input.position.avgEntryPrice) / input.position.avgEntryPrice) * 100
      : ((input.position.avgEntryPrice - input.bar.close) / input.position.avgEntryPrice) * 100

    if (pnlPct > -threshold) return undefined

    return {
      type: 'CLOSE',
      targetQty: 0,
      reason: 'risk.max_floating_loss',
      source: 'risk',
    }
  }

  private evaluateOutsideBand(input: RiskEvaluationInput): RiskDecision | undefined {
    const rule = input.riskRules?.outsideBand
    if (!rule) return undefined

    const direction = Math.sign(input.position.qty)
    if (direction !== 1 && direction !== -1) {
      this.outsideBandStreakBySymbol.delete(input.symbol)
      return undefined
    }

    const bounds = this.resolveOutsideBandBounds(input, rule)
    if (!bounds) {
      return undefined
    }

    const isAdverseOutside = direction > 0
      ? input.bar.close < bounds.lowerBound
      : input.bar.close > bounds.upperBound
    const previousState = this.outsideBandStreakBySymbol.get(input.symbol)
    const previousStreak = previousState?.direction === direction ? previousState.count : 0
    const currentStreak = isAdverseOutside ? previousStreak + 1 : 0
    this.outsideBandStreakBySymbol.set(input.symbol, {
      direction,
      count: currentStreak,
    })

    const required = Number.isFinite(rule.consecutiveBars) && rule.consecutiveBars && rule.consecutiveBars > 0
      ? Math.floor(rule.consecutiveBars)
      : 3
    if (currentStreak < required) return undefined

    if (rule.action === 'REDUCE') {
      const ratio = Number.isFinite(rule.reduceRatio) && rule.reduceRatio && rule.reduceRatio > 0 && rule.reduceRatio < 1
        ? rule.reduceRatio
        : 0.5
      return {
        type: 'REDUCE',
        targetQty: input.position.qty * (1 - ratio),
        reason: 'risk.consecutive_outside_band',
        source: 'risk',
      }
    }

    return {
      type: 'CLOSE',
      targetQty: 0,
      reason: 'risk.consecutive_outside_band',
      source: 'risk',
    }
  }

  private resolveOutsideBandBounds(
    input: RiskEvaluationInput,
    rule: NonNullable<BacktestRiskRules['outsideBand']>,
  ): { lowerBound: number; upperBound: number } | undefined {
    if (rule.mode === 'BOLLINGER_BANDS') {
      const period = rule.indicator?.period
      const stdDev = rule.indicator?.stdDev
      if (!Number.isFinite(period) || !period || period <= 1 || !Number.isFinite(stdDev)) {
        return undefined
      }

      const closes = (input.historyBars ?? [])
        .map(item => item.close)
        .filter(value => Number.isFinite(value))
      if (closes.length < period) {
        return undefined
      }

      const series = closes.slice(-period)
      const mean = series.reduce((sum, value) => sum + value, 0) / series.length
      const variance = series.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / series.length
      const bandWidth = Math.sqrt(variance) * stdDev
      return {
        lowerBound: mean - bandWidth,
        upperBound: mean + bandWidth,
      }
    }

    if (!Number.isFinite(rule.lowerBound) || !Number.isFinite(rule.upperBound) || rule.upperBound <= rule.lowerBound) {
      return undefined
    }

    return {
      lowerBound: rule.lowerBound,
      upperBound: rule.upperBound,
    }
  }
}
