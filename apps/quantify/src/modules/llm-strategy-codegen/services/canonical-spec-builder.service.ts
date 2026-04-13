import type { CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec'
import type { ChecklistRuleBasis } from '../types/codegen-checklist'
import { Injectable } from '@nestjs/common'
import { CANONICAL_RULE_KEYS, DEFAULT_INDICATOR_PARAMS } from '../constants/canonical-strategy-capabilities'
import {
  buildChecklistRuleDrafts,
  resolveChecklistDefaultTimeframe,
  resolveRequiredRuleTimeframes,
  resolveRulePhaseDefaultTimeframe,
} from './checklist-rule-drafts'
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'

interface ChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
  entryRuleBases?: unknown
  exitRuleBases?: unknown
  entryRuleDrafts?: unknown
  exitRuleDrafts?: unknown
  market?: unknown
}

@Injectable()
export class CanonicalSpecBuilderService {
  build(checklist: ChecklistSnapshot): CanonicalStrategySpecV2 {
    const normalizedChecklist = checklist as ChecklistSnapshot & Parameters<typeof buildChecklistRuleDrafts>[0]
    const ruleDrafts = buildChecklistRuleDrafts(normalizedChecklist)
    const entryRules = Array.isArray(checklist.entryRules) ? checklist.entryRules : []
    const exitRules = Array.isArray(checklist.exitRules) ? checklist.exitRules : []
    const riskRules = checklist.riskRules && typeof checklist.riskRules === 'object' && !Array.isArray(checklist.riskRules)
      ? checklist.riskRules as Record<string, unknown>
      : {}
    const entryTexts = entryRules.map(item => String(item))
    const exitTexts = exitRules.map(item => String(item))
    const sharedGridParams = this.resolveGridParams([...entryTexts, ...exitTexts].join(' '))
    const sizing = this.resolveSizing(riskRules)
    const market = this.resolveMarket(normalizedChecklist, riskRules, ruleDrafts)
    const indicators = this.resolveIndicators(entryTexts, exitTexts, riskRules)
    const requiredTimeframes = resolveRequiredRuleTimeframes(ruleDrafts, market.defaultTimeframe)
    const dominantEntrySideScope = this.resolveDominantEntrySideScope(entryTexts)

    const rules: CanonicalRuleV2[] = []

    entryTexts.forEach((ruleText, index) => {
      const openAction = this.detectOpenAction(ruleText)
      const priceChangeRule = this.buildPriceChangeRule({
        ruleText,
        index,
        phase: 'entry',
        actionType: openAction?.type ?? null,
        sideScope: openAction?.sideScope ?? null,
        sizing,
        ruleDraft: ruleDrafts.entry[index],
      })
      if (priceChangeRule) {
        rules.push(priceChangeRule)
        return
      }
      const gridEntryRule = this.buildGridRule({
        ruleText,
        index,
        phase: 'entry',
        actionType: openAction?.type ?? null,
        sideScope: openAction?.sideScope ?? null,
        sizing,
        sharedGridParams,
        ruleDraft: ruleDrafts.entry[index],
      })
      if (gridEntryRule) {
        rules.push(gridEntryRule)
        return
      }

      if (this.isBreakoutRule(ruleText)) {
        const breakoutRule = this.buildBreakoutRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction?.type ?? 'OPEN_LONG',
          sideScope: openAction?.sideScope ?? 'long',
          sizing,
        })
        if (breakoutRule) {
          rules.push(breakoutRule)
          return
        }
      }

      if (!openAction) return

      if (this.isMovingAverageRule(ruleText)) {
        const movingAverageRule = this.buildMovingAverageRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (movingAverageRule) {
          rules.push(movingAverageRule)
        }
      }

      if (this.isRsiRule(ruleText)) {
        const rsiRule = this.buildRsiRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (rsiRule) {
          rules.push(rsiRule)
        }
      }

      if (this.isMacdRule(ruleText)) {
        const macdRule = this.buildMacdRule({
          ruleText,
          index,
          phase: 'entry',
          actionType: openAction.type,
          sideScope: openAction.sideScope,
          sizing,
        })
        if (macdRule) {
          rules.push(macdRule)
        }
      }

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
      const closeAction = this.detectCloseAction(ruleText, dominantEntrySideScope)
      const priceChangeRule = this.buildPriceChangeRule({
        ruleText,
        index,
        phase: 'exit',
        actionType: closeAction?.type ?? null,
        sideScope: closeAction?.sideScope ?? null,
        sizing,
        ruleDraft: ruleDrafts.exit[index],
      })
      if (priceChangeRule) {
        rules.push(priceChangeRule)
        return
      }
      const gridExitRule = this.buildGridRule({
        ruleText,
        index,
        phase: 'exit',
        actionType: null,
        sideScope: null,
        sizing,
        sharedGridParams,
        ruleDraft: ruleDrafts.exit[index],
      })
      if (gridExitRule) {
        rules.push(gridExitRule)
        return
      }

      if (closeAction && this.isMovingAverageRule(ruleText)) {
        const movingAverageRule = this.buildMovingAverageRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (movingAverageRule) {
          rules.push(movingAverageRule)
        }
      }

      if (closeAction && this.isRsiRule(ruleText)) {
        const rsiRule = this.buildRsiRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (rsiRule) {
          rules.push(rsiRule)
        }
      }

      if (closeAction && this.isMacdRule(ruleText)) {
        const macdRule = this.buildMacdRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (macdRule) {
          rules.push(macdRule)
        }
      }

      if (closeAction && this.isBreakoutRule(ruleText)) {
        const breakoutRule = this.buildBreakoutRule({
          ruleText,
          index,
          phase: 'exit',
          actionType: closeAction.type,
          sideScope: closeAction.sideScope,
          sizing,
        })
        if (breakoutRule) {
          rules.push(breakoutRule)
        }
      }

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
    const stopLossBasis = this.resolveRiskBasis(
      typeof riskRules.stopLoss === 'string' ? riskRules.stopLoss : stopLossPct !== null ? `止损 ${stopLossPct}%` : null,
      riskRules.stopLossBasis,
    )
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
          ...(stopLossBasis ? { params: { basis: stopLossBasis } } : {}),
        },
        actions: [{ type: 'FORCE_EXIT' }],
        ...(stopLossBasis ? { metadata: { basis: stopLossBasis } } : {}),
      })
    }

    const takeProfitRule = this.resolveTakeProfitRule(
      [...exitTexts, ...Object.values(riskRules).map(item => String(item))],
      riskRules,
    )
    const takeProfitBasis = this.resolveRiskBasis(
      typeof riskRules.takeProfit === 'string'
        ? riskRules.takeProfit
        : takeProfitRule ? `止盈 ${takeProfitRule.pct}%` : null,
      riskRules.takeProfitBasis,
    )
    if (takeProfitRule) {
      rules.push({
        id: 'risk-take-profit',
        phase: 'risk',
        sideScope: takeProfitRule.sideScope,
        priority: 115,
        condition: {
          kind: 'atom',
          key: 'risk.take_profit_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((takeProfitRule.pct / 100).toFixed(4)),
          ...(takeProfitBasis ? { params: { basis: takeProfitBasis } } : {}),
        },
        actions: takeProfitRule.actions,
        ...(takeProfitBasis ? { metadata: { basis: takeProfitBasis } } : {}),
      })
    }

    const trailingStopRule = this.resolveTrailingStopRule([...exitTexts, ...Object.values(riskRules).map(item => String(item))])
    if (trailingStopRule) {
      rules.push({
        id: 'risk-trailing-stop',
        phase: 'risk',
        sideScope: trailingStopRule.sideScope,
        priority: 114,
        condition: {
          kind: 'atom',
          key: 'risk.trailing_stop_pct',
          semanticScope: 'position',
          op: 'GTE',
          value: Number((trailingStopRule.pct / 100).toFixed(4)),
        },
        actions: trailingStopRule.actions,
      })
    }

    const timeStopRule = this.resolveTimeStopRule(exitTexts)
    if (timeStopRule) {
      rules.push({
        id: 'exit-time-stop-bars',
        phase: 'exit',
        sideScope: timeStopRule.sideScope,
        priority: 113,
        condition: {
          kind: 'atom',
          key: 'risk.time_stop_bars',
          semanticScope: 'position',
          op: 'GTE',
          value: timeStopRule.bars,
        },
        actions: timeStopRule.actions,
      })
    }

    const earlyStopText = typeof riskRules.earlyStop === 'string' ? riskRules.earlyStop : ''
    const outsideBandSourceText = [
      ...exitTexts,
      earlyStopText,
    ].find(text => /连续\s*3|3\s*根/.test(text) && /轨外|outside/i.test(text)) ?? ''

    if (outsideBandSourceText) {
      const outsideBandActions = this.resolveOutsideBandRiskActions(outsideBandSourceText)

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
          metadata: { source: outsideBandSourceText === earlyStopText ? 'riskRules.earlyStop' : 'exitRules' },
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
    if (/做空|空单|开空|卖出开空|short/i.test(ruleText)) {
      return { type: 'OPEN_SHORT', sideScope: 'short' }
    }
    if (/做多|多单|开多|买入|买进|开仓|long/i.test(ruleText)) {
      return { type: 'OPEN_LONG', sideScope: 'long' }
    }
    return null
  }

  private detectCloseAction(
    ruleText: string,
    fallbackSideScope: 'long' | 'short' | null = null,
  ): { type: 'CLOSE_LONG' | 'CLOSE_SHORT'; sideScope: 'long' | 'short' } | null {
    if (/平空|空单止盈|买回|回补|close\s*short/i.test(ruleText)) {
      return { type: 'CLOSE_SHORT', sideScope: 'short' }
    }
    if (/平多|多单止盈|close\s*long/i.test(ruleText)) {
      return { type: 'CLOSE_LONG', sideScope: 'long' }
    }
    if (/卖出|平仓|离场|出场/.test(ruleText)) {
      if (fallbackSideScope === 'short') {
        return { type: 'CLOSE_SHORT', sideScope: 'short' }
      }
      if (fallbackSideScope === 'long') {
        return { type: 'CLOSE_LONG', sideScope: 'long' }
      }
      return null
    }
    return null
  }

  private resolveDominantEntrySideScope(entryRules: string[]): 'long' | 'short' | null {
    const scoped = entryRules
      .map((rule) => {
        const explicit = this.detectOpenAction(rule)?.sideScope ?? null
        if (explicit) {
          return explicit
        }
        if (/买入|买进|开仓|入场/.test(rule)) {
          return 'long'
        }
        return null
      })
      .filter((side): side is 'long' | 'short' => side === 'long' || side === 'short')

    if (scoped.length === 0) {
      return null
    }

    const unique = [...new Set(scoped)]
    return unique.length === 1 ? unique[0] ?? null : null
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

  private resolveRiskBasis(
    ruleText: string | null,
    explicitBasis: unknown,
  ): ChecklistRuleBasis['kind'] | null {
    if (typeof explicitBasis === 'string' && explicitBasis.trim()) {
      return explicitBasis.trim() as ChecklistRuleBasis['kind']
    }
    if (!ruleText?.trim()) {
      return null
    }
    return resolveDefaultRiskBasis(ruleText, null)
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
    ruleDrafts: ReturnType<typeof buildChecklistRuleDrafts>,
  ): CanonicalStrategySpecV2['market'] {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const market = checklist.market && typeof checklist.market === 'object' && !Array.isArray(checklist.market)
      ? checklist.market as Record<string, unknown>
      : null
    const rawSymbol = typeof symbols[0] === 'string' ? symbols[0].trim().toUpperCase() : ''
    const rawTimeframe = resolveRulePhaseDefaultTimeframe(
      ruleDrafts.entry,
      resolveChecklistDefaultTimeframe(checklist as Parameters<typeof resolveChecklistDefaultTimeframe>[0]),
    ) ?? ruleDrafts.exit.find(draft => draft.timeframe)?.timeframe ?? ''
    const riskExchange = typeof riskRules.exchange === 'string' ? riskRules.exchange.trim().toLowerCase() : ''
    const riskMarketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''
    const marketExchange = typeof market?.exchange === 'string' ? market.exchange.trim().toLowerCase() : ''
    const marketType = typeof market?.marketType === 'string' ? market.marketType.trim().toLowerCase() : ''

    return {
      exchange: marketExchange === 'okx' || marketExchange === 'hyperliquid' || marketExchange === 'binance'
        ? marketExchange
        : (riskExchange === 'okx' || riskExchange === 'hyperliquid' || riskExchange === 'binance'
            ? riskExchange
            : 'binance'),
      symbol: rawSymbol || null,
      marketType: marketType === 'perp' ? 'perp' : (riskMarketType === 'perp' ? 'perp' : 'spot'),
      defaultTimeframe: rawTimeframe || null,
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

    const indicators: CanonicalStrategySpecV2['indicators'] = []
    const pushIndicator = (indicator: CanonicalStrategySpecV2['indicators'][number]) => {
      if (!indicators.some(item => item.kind === indicator.kind)) {
        indicators.push(indicator)
      }
    }
    const hasDonchianBreakout = allTexts.some(text => /唐奇安|donchian/iu.test(text))
      && allTexts.some(text => /上轨|下轨|breakout|breakdown|highest|lowest/iu.test(text))
    const hasBollingerSemantics = !hasDonchianBreakout
      && allTexts.some(text => /布林|bollinger|上轨|下轨|中轨|upper\s*band|lower\s*band|middle\s*band/iu.test(text))
    const bollingerParams = this.resolveBollingerParams(allTexts)
    const movingAverageConfig = this.resolveMovingAverageConfig(allTexts)
    const macdParams = this.resolveMacdParams(allTexts)

    if (hasBollingerSemantics) {
      pushIndicator({
        kind: 'bollingerBands',
        params: { ...bollingerParams },
      })
    }

    if (!hasBollingerSemantics && allTexts.some(text => this.isMovingAverageRule(text))) {
      pushIndicator({
        kind: movingAverageConfig.kind,
        params: movingAverageConfig.params,
      })
    }

    if (allTexts.some(text => /\brsi\b|相对强弱|超买|超卖/iu.test(text))) {
      pushIndicator({
        kind: 'rsi',
        params: { period: this.resolveRsiPeriod(allTexts) },
      })
    }

    if (allTexts.some(text => /\bmacd\b|指数平滑异同|快线|慢线/iu.test(text))) {
      pushIndicator({
        kind: 'macd',
        params: { ...macdParams },
      })
    }

    if (hasDonchianBreakout) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'breakout' },
      })
    }

    if (allTexts.some(text => /网格/u.test(text))) {
      pushIndicator({
        kind: 'custom',
        params: { family: 'grid' },
      })
    }

    return indicators
  }

  private resolveOutsideBandRiskActions(text: string): CanonicalRuleV2['actions'] | null {
    if (/全平|全部平仓|直接平仓|清仓|强平|force\s*exit|force\s*close/iu.test(text)) {
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

  private isMovingAverageRule(text: string): boolean {
    return /均线|moving average|\bsma\b|\bema\b|sma\s*\d+|ema\s*\d+|ma\s*\d+|\d+\s*日线/iu.test(text)
      || ((/金叉|死叉|上穿|下穿/u.test(text)) && /均线|\bma\b|\bsma\b|\bema\b|sma\s*\d+|ema\s*\d+|ma\s*\d+|\d+\s*日线/i.test(text))
  }

  private isRsiRule(text: string): boolean {
    return /\brsi\b|相对强弱|超买|超卖/iu.test(text)
  }

  private isMacdRule(text: string): boolean {
    return /\bmacd\b|指数平滑异同|快线|慢线/iu.test(text)
  }

  private isBreakoutRule(text: string): boolean {
    return /前高|前低|最高价|最低价|通道上轨|通道下轨|关键阻力|阻力位|关键支撑|支撑位|唐奇安|donchian|breakout|breakdown|highest|lowest/i.test(text)
  }

  private buildMovingAverageRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const ruleKey = /金叉|上穿/u.test(input.ruleText)
      ? 'ma.golden_cross'
      : /死叉|下穿/u.test(input.ruleText)
          ? 'ma.death_cross'
          : null
    if (!ruleKey) return null

    const operator = ruleKey === 'ma.golden_cross' ? 'CROSS_OVER' : 'CROSS_UNDER'

    return {
      id: `${input.phase}-${ruleKey.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 200 - input.index : 140 - input.index,
      condition: {
        kind: 'atom',
        key: ruleKey,
        semanticScope: 'market',
        op: operator,
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildRsiRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const threshold = this.resolveRsiThreshold(input.ruleText)
    if (!threshold) return null

    return {
      id: `${input.phase}-${threshold.key.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 180 - input.index : 130 - input.index,
      condition: {
        kind: 'atom',
        key: threshold.key,
        semanticScope: 'market',
        op: threshold.op,
        value: threshold.value,
        params: { period: this.resolveRsiPeriod([input.ruleText]) },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildMacdRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const ruleKey = /金叉|上穿/u.test(input.ruleText)
      ? CANONICAL_RULE_KEYS.macdGoldenCross
      : /死叉|下穿/u.test(input.ruleText)
          ? CANONICAL_RULE_KEYS.macdDeathCross
          : null
    if (!ruleKey) return null

    return {
      id: `${input.phase}-${ruleKey.replace('.', '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 175 - input.index : 125 - input.index,
      condition: {
        kind: 'atom',
        key: ruleKey,
        semanticScope: 'market',
        op: ruleKey === CANONICAL_RULE_KEYS.macdGoldenCross ? 'CROSS_OVER' : 'CROSS_UNDER',
        params: { ...DEFAULT_INDICATOR_PARAMS.macd },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType }],
    }
  }

  private buildGridRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null
    sideScope: 'long' | 'short' | null
    sizing: { mode: 'RATIO'; value: number } | null
    sharedGridParams: {
      rangeMin: number
      rangeMax: number
      stepPct: number
      levelCount: number
    } | null
    ruleDraft?: { timeframe: string | null } | undefined
  }): CanonicalRuleV2 | null {
    if (!/网格/u.test(input.ruleText)) return null

    const params = this.resolveGridParams(input.ruleText) ?? input.sharedGridParams
    if (!params) return null

    const semantics = this.resolveGridSemantics(input.ruleText, input.phase, input.actionType, input.sideScope)

    return {
      id: `${input.phase}-grid-level-touch-${input.index + 1}`,
      phase: input.phase,
      sideScope: semantics.sideScope,
      priority: input.phase === 'entry' ? 170 - input.index : 120 - input.index,
      condition: {
        kind: 'atom',
        key: 'grid.range_rebalance',
        semanticScope: 'market',
        op: semantics.op,
        params: {
          ...params,
          ...(input.ruleDraft?.timeframe ? { timeframe: input.ruleDraft.timeframe } : {}),
        },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(semantics.action as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: semantics.action as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
    }
  }

  private buildBreakoutRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    sizing: { mode: 'RATIO'; value: number } | null
  }): CanonicalRuleV2 | null {
    const period = this.resolveBreakoutPeriod(input.ruleText)
    const isHighBreak = /前高|最高价|通道上轨|关键阻力|阻力位|唐奇安.*上轨|donchian.*upper|breakout|highest/i.test(input.ruleText)
    const isLowBreak = /前低|最低价|通道下轨|关键支撑|支撑位|唐奇安.*下轨|donchian.*lower|breakdown|lowest/i.test(input.ruleText)
    const key = isHighBreak
      ? 'breakout.channel_high_break'
      : (isLowBreak ? 'breakout.channel_low_break' : null)
    if (!key) return null

    return {
      id: `${input.phase}-${key.replace(/\./g, '-')}-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 165 - input.index : 118 - input.index,
      cooldownBars: input.phase === 'entry' ? this.resolveCooldownBars(input.ruleText) : undefined,
      condition: {
        kind: 'atom',
        key,
        semanticScope: 'market',
        op: key === 'breakout.channel_high_break' ? 'CROSS_OVER' : 'CROSS_UNDER',
        params: { period },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
    }
  }

  private buildPriceChangeRule(input: {
    ruleText: string
    index: number
    phase: 'entry' | 'exit'
    actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null
    sideScope: 'long' | 'short' | null
    sizing: { mode: 'RATIO'; value: number } | null
    ruleDraft?: { timeframe: string | null, basis?: string | null } | undefined
  }): CanonicalRuleV2 | null {
    const timeframe = input.ruleDraft?.timeframe ?? this.extractRuleTimeframe(input.ruleText)
    const pctChange = this.extractPriceChangePct(input.ruleText)
    if (!timeframe || !pctChange || !input.actionType || !input.sideScope) {
      return null
    }

    const isDrop = pctChange.direction === 'drop'
    const numericPct = pctChange.value
    if (!Number.isFinite(numericPct) || numericPct <= 0) {
      return null
    }

    const normalizedValue = Number((numericPct / 100).toFixed(4))
    const explicitBasis = input.ruleDraft?.basis
    const usesPositionBasis = input.phase === 'exit' && (explicitBasis === 'entry_avg_price' || explicitBasis === 'position_pnl')
    return {
      id: `${input.phase}-price-change-${input.index + 1}`,
      phase: input.phase,
      sideScope: input.sideScope,
      priority: input.phase === 'entry' ? 210 - input.index : 135 - input.index,
      condition: {
        kind: 'atom',
        key: usesPositionBasis ? 'position_gain_pct' : 'price.change_pct',
        semanticScope: usesPositionBasis ? 'position' : 'market',
        op: isDrop ? 'LTE' : 'GTE',
        value: isDrop ? -normalizedValue : normalizedValue,
        params: {
          timeframe,
          lookbackBars: 1,
          ...(explicitBasis ? { basis: explicitBasis } : {}),
        },
      },
      actions: [input.phase === 'entry'
        ? this.buildOpenAction(input.actionType as 'OPEN_LONG' | 'OPEN_SHORT', input.sizing)
        : { type: input.actionType as 'CLOSE_LONG' | 'CLOSE_SHORT' }],
      ...(explicitBasis ? { metadata: { basis: explicitBasis } } : {}),
    }
  }

  private resolveRsiThreshold(text: string): {
    key:
      | typeof CANONICAL_RULE_KEYS.rsiThresholdLte
      | typeof CANONICAL_RULE_KEYS.rsiThresholdGte
      | typeof CANONICAL_RULE_KEYS.rsiCrossOver
      | typeof CANONICAL_RULE_KEYS.rsiCrossUnder
    op: 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
    value: number
  } | null {
    const operatorThreshold = text.match(/(?:<=|＜=|>=|＞=|低于|小于|高于|大于|上穿|下穿|突破|跌破)\s*(\d{1,3})/u)
    const numericTokens = Array.from(text.matchAll(/(\d{1,3})/g))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value) && value >= 0 && value <= 100)
    const explicitThreshold = operatorThreshold?.[1]
      ? Number(operatorThreshold[1])
      : numericTokens.length >= 2
      ? numericTokens[numericTokens.length - 1]
      : (numericTokens.length === 1 ? numericTokens[0] : null)
    const threshold = explicitThreshold
      ?? (/超卖/u.test(text) ? 30 : (/超买/u.test(text) ? 70 : null))

    if (threshold === null) return null

    if (/上穿|突破/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiCrossOver,
        op: 'CROSS_OVER',
        value: threshold,
      }
    }

    if (/下穿|跌破/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiCrossUnder,
        op: 'CROSS_UNDER',
        value: threshold,
      }
    }

    if (/<=|＜=|小于等于|低于|小于|超卖|低位/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiThresholdLte,
        op: 'LTE',
        value: threshold,
      }
    }

    if (/>=|＞=|大于等于|高于|大于|超买|高位/u.test(text)) {
      return {
        key: CANONICAL_RULE_KEYS.rsiThresholdGte,
        op: 'GTE',
        value: threshold,
      }
    }

    return null
  }

  private resolveRsiPeriod(texts: string[]): number {
    for (const text of texts) {
      const matched = text.match(/(?:RSI|相对强弱)\D{0,4}(\d{1,2})/iu)
      if (matched?.[1]) {
        const period = Number(matched[1])
        if (Number.isFinite(period) && period > 0) {
          return period
        }
      }
    }

    return DEFAULT_INDICATOR_PARAMS.rsi.period
  }

  private extractRuleTimeframe(text: string): string | null {
    const matched = text.match(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/iu)
    if (!matched?.[1] || !matched[2]) {
      return null
    }
    const value = matched[1]
    const unit = matched[2].toLowerCase()
    if (unit === 'm' || unit === 'min' || unit === '分钟') return `${value}m`
    if (unit === 'h' || unit === '小时') return `${value}h`
    return `${value}d`
  }

  private extractPriceChangePct(
    text: string,
  ): { direction: 'drop' | 'rise'; value: number } | null {
    const percentPattern = /(下跌|跌|回撤|上涨|涨|反弹)\s*(?:(\d+(?:\.\d+)?)\s*%|百分之?\s*(\d+(?:\.\d+)?))/u
    const matched = text.match(percentPattern)
    if (!matched?.[1]) {
      return null
    }
    const rawValue = matched[2] ?? matched[3]
    if (!rawValue) {
      return null
    }

    return {
      direction: /下跌|跌|回撤/u.test(matched[1]) ? 'drop' : 'rise',
      value: Number(rawValue),
    }
  }

  private resolveBollingerParams(
    texts: string[],
  ): { period: number; stdDev: number } {
    for (const text of texts) {
      const matched = text.match(/布林带\s*[（(]\s*(\d{1,3})\s*[,，]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
      if (matched?.[1] && matched[2]) {
        return {
          period: Number(matched[1]),
          stdDev: Number(matched[2]),
        }
      }
    }

    for (const text of texts) {
      const middleMatch = text.match(/中轨\s*\(?(?:MA|ma)\s*(\d{1,3})\)?/u)
      if (middleMatch?.[1]) {
        return {
          period: Number(middleMatch[1]),
          stdDev: DEFAULT_INDICATOR_PARAMS.bollingerBands.stdDev,
        }
      }
    }

    return { ...DEFAULT_INDICATOR_PARAMS.bollingerBands }
  }

  private resolveMovingAverageConfig(
    texts: string[],
  ): {
    kind: 'sma' | 'ema'
    params: Record<string, number>
  } {
    for (const text of texts) {
      const pairMatch = text.match(/(?:EMA|ema|SMA|sma)?\s*(\d{1,3})\D{0,12}(?:EMA|ema|SMA|sma|日线|均线)\s*(\d{1,3})/u)
        ?? text.match(/(\d{1,3})\s*日线\D{0,12}(\d{1,3})\s*日线/u)
      if (pairMatch?.[1] && pairMatch[2]) {
        const first = Number(pairMatch[1])
        const second = Number(pairMatch[2])
        const fast = Math.min(first, second)
        const slow = Math.max(first, second)
        const kind = /\bema\b|EMA/u.test(text) ? 'ema' : 'sma'
        return {
          kind,
          params: { fast, slow },
        }
      }
    }

    return {
      kind: 'sma',
      params: { ...DEFAULT_INDICATOR_PARAMS.sma },
    }
  }

  private resolveMacdParams(
    texts: string[],
  ): { fastPeriod: number; slowPeriod: number; signalPeriod: number } {
    for (const text of texts) {
      const matched = text.match(/(?:MACD|macd)\s*[（(]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[)）]/u)
      if (matched?.[1] && matched[2] && matched[3]) {
        return {
          fastPeriod: Number(matched[1]),
          slowPeriod: Number(matched[2]),
          signalPeriod: Number(matched[3]),
        }
      }
    }

    return { ...DEFAULT_INDICATOR_PARAMS.macd }
  }

  private resolveGridParams(text: string): {
    rangeMin: number
    rangeMax: number
    stepPct: number
    levelCount: number
  } | null {
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.resolveGridStepPct(text)
    const levelMatch = text.match(/(?:共|总计)?\s*(\d+)\s*格/u)
    if (!rangeMatch?.[1] || !rangeMatch[2] || stepPct === null || !levelMatch?.[1]) {
      return null
    }

    return {
      rangeMin: Number(rangeMatch[1]),
      rangeMax: Number(rangeMatch[2]),
      stepPct,
      levelCount: Number(levelMatch[1]),
    }
  }

  private resolveGridStepPct(text: string): number | null {
    const percentMatch = text.match(/(?:步长|网格步长)\s*(\d+(?:\.\d+)?)\s*%/u)
    if (percentMatch?.[1]) {
      return Number(percentMatch[1])
    }

    const perMilleMatch = text.match(/千分之\s*(\d+(?:\.\d+)?)/u)
    if (perMilleMatch?.[1]) {
      return Number(perMilleMatch[1]) / 10
    }

    return null
  }

  private resolveGridSemantics(
    text: string,
    phase: 'entry' | 'exit',
    fallbackAction: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | null,
    fallbackSideScope: 'long' | 'short' | null,
  ): {
    action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    sideScope: 'long' | 'short'
    op: 'LTE' | 'GTE'
  } {
    const upperBias = /上方网格|上轨|上沿|上层/u.test(text)
    const lowerBias = /下方网格|下轨|下沿|下层/u.test(text)
    const shortEntry = /做空|开空|卖出开空|sell short/u.test(text)
    const shortExit = /买回|平空|回补/u.test(text)

    if (phase === 'entry') {
      if (shortEntry || upperBias || fallbackAction === 'OPEN_SHORT' || fallbackSideScope === 'short') {
        return {
          action: 'OPEN_SHORT',
          sideScope: 'short',
          op: 'GTE',
        }
      }

      return {
        action: 'OPEN_LONG',
        sideScope: 'long',
        op: 'LTE',
      }
    }

    if (shortExit || lowerBias || fallbackAction === 'CLOSE_SHORT' || fallbackSideScope === 'short') {
      return {
        action: 'CLOSE_SHORT',
        sideScope: 'short',
        op: 'LTE',
      }
    }

    return {
      action: 'CLOSE_LONG',
      sideScope: 'long',
      op: upperBias ? 'GTE' : (lowerBias ? 'LTE' : 'GTE'),
    }
  }

  private resolveBreakoutPeriod(text: string): number {
    const matched = text.match(/前\s*(\d+)\s*根?K?线?/u)
    return matched?.[1] ? Number(matched[1]) : 20
  }

  private resolveCooldownBars(text: string): number | undefined {
    const matched = text.match(/冷却\s*(\d+)\s*根?K?线?/u)
    if (!matched?.[1]) return undefined
    const value = Number(matched[1])
    return Number.isFinite(value) && value > 0 ? value : undefined
  }

  private resolveTakeProfitRule(
    texts: string[],
    riskRules: Record<string, unknown> = {},
  ): {
    pct: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    if (
      typeof riskRules.takeProfitPct === 'number'
      && Number.isFinite(riskRules.takeProfitPct)
      && riskRules.takeProfitPct > 0
    ) {
      return {
        pct: riskRules.takeProfitPct,
        ...this.resolveExitActionSemantics(
          typeof riskRules.takeProfit === 'string' && riskRules.takeProfit.trim()
            ? riskRules.takeProfit
            : '止盈',
        ),
      }
    }

    for (const text of texts) {
      const matched = text.match(/(?:止盈|take[_\s-]?profit)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu)
      if (matched?.[1]) {
        return {
          pct: Number(matched[1]),
          ...this.resolveExitActionSemantics(text),
        }
      }
      const fallback = text.match(/收益率\D{0,12}(?:达到|大于等于|>=|超过|≥)?\s*(\d+(?:\.\d+)?)\s*%/u)
      if (fallback?.[1] && /止盈/u.test(text)) {
        return {
          pct: Number(fallback[1]),
          ...this.resolveExitActionSemantics(text),
        }
      }
    }
    return null
  }

  private resolveTrailingStopRule(
    texts: string[],
  ): {
    pct: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    for (const text of texts) {
      const matched = text.match(/(?:移动止损|trailing[_\s-]?stop)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu)
      if (matched?.[1]) {
        return {
          pct: Number(matched[1]),
          sideScope: 'both',
          actions: [{ type: 'FORCE_EXIT' }],
        }
      }
    }
    return null
  }

  private resolveTimeStopRule(
    texts: string[],
  ): {
    bars: number
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } | null {
    for (const text of texts) {
      const matched = text.match(/持仓(?:超过|达到)?\s*(\d+)\s*根?K?线?.{0,8}(?:平仓|平多|平空|离场|出场)/u)
      if (matched?.[1]) {
        return {
          bars: Number(matched[1]),
          ...this.resolveTimeStopActionSemantics(text),
        }
      }
      const fallback = text.match(/time[_\s-]?stop\D{0,8}(\d+)/iu)
      if (fallback?.[1]) {
        return {
          bars: Number(fallback[1]),
          ...this.resolveTimeStopActionSemantics(text),
        }
      }
    }
    return null
  }

  private resolveExitActionSemantics(
    text: string,
    options: { allowReduce?: boolean } = {},
  ): {
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } {
    const closeAction = this.detectCloseAction(text)
    const allowReduce = options.allowReduce !== false
    const reduceSizing = this.resolveReduceSizing(text)
    const wantsReduce = allowReduce && /减仓|部分止盈|partial/i.test(text)
    const hasExplicitLongCloseText = /平多|多单|close\s*long/i.test(text)
    const hasExplicitShortCloseText = /平空|空单|close\s*short|买回|回补/i.test(text)

    if (wantsReduce) {
      if (hasExplicitLongCloseText) {
        return {
          sideScope: 'long',
          actions: [{ type: 'REDUCE_LONG', ...(reduceSizing ? { sizing: reduceSizing } : {}) }],
        }
      }
      if (hasExplicitShortCloseText || closeAction?.sideScope === 'short') {
        return {
          sideScope: 'short',
          actions: [{ type: 'REDUCE_SHORT', ...(reduceSizing ? { sizing: reduceSizing } : {}) }],
        }
      }
      return {
        sideScope: 'both',
        actions: [
          { type: 'REDUCE_LONG', ...(reduceSizing ? { sizing: reduceSizing } : {}) },
          { type: 'REDUCE_SHORT', ...(reduceSizing ? { sizing: reduceSizing } : {}) },
        ],
      }
    }

    if (closeAction?.type === 'CLOSE_LONG') {
      return {
        sideScope: 'long',
        actions: [{ type: 'CLOSE_LONG' }],
      }
    }
    if (closeAction?.type === 'CLOSE_SHORT') {
      return {
        sideScope: 'short',
        actions: [{ type: 'CLOSE_SHORT' }],
      }
    }

    return {
      sideScope: 'both',
      actions: [{ type: 'FORCE_EXIT' }],
    }
  }

  private resolveReduceSizing(text: string): { mode: 'RATIO'; value: number } | null {
    if (/减半|一半|half/u.test(text)) {
      return { mode: 'RATIO', value: 0.5 }
    }

    const matched = text.match(/减仓\s*(\d+(?:\.\d+)?)\s*%/u)
    if (!matched?.[1]) return null
    const value = Number(matched[1])
    if (!Number.isFinite(value) || value <= 0) return null
    return {
      mode: 'RATIO',
      value: value > 1 ? Number((value / 100).toFixed(4)) : value,
    }
  }

  private resolveTimeStopActionSemantics(
    text: string,
  ): {
    sideScope: 'long' | 'short' | 'both'
    actions: CanonicalRuleV2['actions']
  } {
    const closeAction = this.detectCloseAction(text)
    if (closeAction?.type === 'CLOSE_LONG') {
      return {
        sideScope: 'long',
        actions: [{ type: 'CLOSE_LONG' }],
      }
    }
    if (closeAction?.type === 'CLOSE_SHORT') {
      return {
        sideScope: 'short',
        actions: [{ type: 'CLOSE_SHORT' }],
      }
    }

    return {
      sideScope: 'both',
      actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
    }
  }
}
