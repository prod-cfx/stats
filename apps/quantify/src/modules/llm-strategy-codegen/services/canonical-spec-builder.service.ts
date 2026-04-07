import type { CanonicalRuleV2, CanonicalStrategySpecAnyVersion, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
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
  build(checklist: ChecklistSnapshot): CanonicalStrategySpecAnyVersion {
    const entryRules = Array.isArray(checklist.entryRules) ? checklist.entryRules : []
    const exitRules = Array.isArray(checklist.exitRules) ? checklist.exitRules : []
    const riskRules = checklist.riskRules && typeof checklist.riskRules === 'object' && !Array.isArray(checklist.riskRules)
      ? checklist.riskRules as Record<string, unknown>
      : {}
    const entryTexts = entryRules.map(item => String(item))
    const exitTexts = exitRules.map(item => String(item))
    const sizing = this.resolveSizing(riskRules)
    const market = this.resolveMarket(checklist, riskRules)
    const indicators = this.resolveIndicators(entryTexts, exitTexts, riskRules)
    const requiredTimeframes = this.resolveRequiredTimeframes(checklist)

    const rules: CanonicalRuleV2[] = []

    entryTexts.forEach((ruleText, index) => {
      const openAction = this.detectOpenAction(ruleText)
      if (!openAction) return

      if (/上轨|upper/i.test(ruleText)) {
        rules.push({
          id: `entry-upper-${index + 1}`,
          phase: 'entry',
          sideScope: openAction.sideScope,
          priority: 200 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.upper_break',
            semanticScope: 'market',
            op: 'CROSS_OVER',
          },
          actions: [this.buildOpenAction(openAction.type, sizing)],
        })
      }

      if (/下轨|lower/i.test(ruleText)) {
        rules.push({
          id: `entry-lower-${index + 1}`,
          phase: 'entry',
          sideScope: openAction.sideScope,
          priority: 190 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.lower_break',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
          },
          actions: [this.buildOpenAction(openAction.type, sizing)],
        })
      }
    })

    exitTexts.forEach((ruleText, index) => {
      if (/中轨|ma20|均线20|middle/i.test(ruleText)) {
        rules.push({
          id: `exit-middle-${index + 1}`,
          phase: 'exit',
          sideScope: 'both',
          priority: 140 - index,
          condition: {
            kind: 'atom',
            key: 'bollinger.middle_revert',
            semanticScope: 'market',
          },
          actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
        })
      }
    })

    const stopLossPct = this.resolveStopLossPct(riskRules)
    if (stopLossPct !== null) {
      rules.push({
        id: 'risk-stop-loss',
        phase: 'risk',
        sideScope: 'both',
        priority: 120,
        condition: {
          kind: 'atom',
          key: 'position_loss_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((stopLossPct / 100).toFixed(4)),
        },
        actions: [{ type: 'FORCE_EXIT' }],
      })
    }

    const earlyStopText = typeof riskRules.earlyStop === 'string' ? riskRules.earlyStop : ''
    if (/连续\s*3|3\s*根/.test(earlyStopText) && /轨外|outside/i.test(earlyStopText)) {
      const outsideBandActions = this.resolveOutsideBandRiskActions(earlyStopText)

      if (outsideBandActions) {
        rules.push({
          id: 'risk-outside-band-3-bars',
          phase: 'risk',
          sideScope: 'both',
          priority: 110,
          condition: {
            kind: 'atom',
            key: 'bollinger.bars_outside',
            semanticScope: 'market',
            op: 'GTE',
            value: 3,
            params: { bars: 3 },
          },
          actions: outsideBandActions,
          metadata: { source: 'riskRules.earlyStop' },
        })
      }
    }

    const spec: CanonicalStrategySpecV2 = {
      version: 2,
      market,
      indicators,
      sizing,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes,
      },
      rules,
    }

    return spec
  }

  private detectOpenAction(ruleText: string): { type: 'OPEN_LONG' | 'OPEN_SHORT'; sideScope: 'long' | 'short' } | null {
    if (/做空|空单|short/i.test(ruleText)) {
      return { type: 'OPEN_SHORT', sideScope: 'short' }
    }
    if (/做多|多单|long/i.test(ruleText)) {
      return { type: 'OPEN_LONG', sideScope: 'long' }
    }
    return null
  }

  private resolveStopLossPct(riskRules: Record<string, unknown>): number | null {
    const stopLossPct = typeof riskRules.stopLossPct === 'number'
      ? riskRules.stopLossPct
      : typeof riskRules.stopLoss === 'number'
        ? riskRules.stopLoss
        : null

    if (typeof stopLossPct !== 'number' || !Number.isFinite(stopLossPct) || stopLossPct <= 0 || stopLossPct > 100) {
      return null
    }

    return stopLossPct
  }

  private resolveSizing(riskRules: Record<string, unknown>): { mode: 'RATIO'; value: number } | null {
    const hasPositionPct = typeof riskRules.positionPct === 'number'
    if (!hasPositionPct) return null

    const rawPositionPct = typeof riskRules.positionPct === 'number' ? riskRules.positionPct : 10
    const ratioValue = rawPositionPct > 1 ? rawPositionPct / 100 : rawPositionPct
    return {
      mode: 'RATIO',
      value: Number(ratioValue.toFixed(4)),
    }
  }

  private resolveMarket(
    checklist: ChecklistSnapshot,
    riskRules: Record<string, unknown>,
  ): CanonicalStrategySpecV2['market'] {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const timeframes = Array.isArray(checklist.timeframes) ? checklist.timeframes : []
    const rawSymbol = typeof symbols[0] === 'string' ? symbols[0].trim().toUpperCase() : ''
    const rawTimeframe = typeof timeframes[0] === 'string' ? timeframes[0].trim() : ''
    const riskMarketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''

    return {
      exchange: 'binance',
      symbol: rawSymbol || null,
      marketType: riskMarketType === 'perp' ? 'perp' : 'spot',
      timeframe: rawTimeframe || null,
    }
  }

  private resolveIndicators(
    entryTexts: string[],
    exitTexts: string[],
    riskRules: Record<string, unknown>,
  ): CanonicalStrategySpecV2['indicators'] {
    const riskTexts = Object.values(riskRules)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    const allTexts = [...entryTexts, ...exitTexts, ...riskTexts]

    if (allTexts.some(text => /(布林|bollinger|上轨|下轨|中轨)/iu.test(text))) {
      return [{
        kind: 'bollingerBands',
        params: { period: 20, stdDev: 2 },
      }]
    }

    return []
  }

  private resolveRequiredTimeframes(checklist: ChecklistSnapshot): string[] {
    const timeframes = Array.isArray(checklist.timeframes) ? checklist.timeframes : []
    return timeframes
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  private resolveOutsideBandRiskActions(text: string): CanonicalRuleV2['actions'] | null {
    if (/全平|全部平仓|清仓|强平|force\s*exit|force\s*close/iu.test(text)) {
      return [{ type: 'FORCE_EXIT' }]
    }

    if (/减仓|reduce/iu.test(text)) {
      return [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }]
    }

    return null
  }

  private buildOpenAction(
    type: 'OPEN_LONG' | 'OPEN_SHORT',
    sizing: { mode: 'RATIO'; value: number } | null,
  ): CanonicalRuleV2['actions'][number] {
    if (!sizing) {
      return { type }
    }

    return {
      type,
      sizing,
    }
  }
}
