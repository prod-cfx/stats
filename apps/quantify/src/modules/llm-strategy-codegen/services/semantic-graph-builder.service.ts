import type { ChecklistPayload, ChecklistRuleBasis } from '../types/checklist-compat'
import type { SemanticStrategyGraph } from '../types/semantic-strategy-graph'
import { Injectable } from '@nestjs/common'
import { buildChecklistRuleDrafts, resolveChecklistDefaultTimeframe, resolveRulePhaseDefaultTimeframe } from './checklist-compat'

export interface SemanticGraphBuildResult {
  graph: SemanticStrategyGraph | null
  unsupportedFeatures: string[]
  diagnostics: string[]
}

@Injectable()
export class SemanticGraphBuilderService {
  build(checklist: ChecklistPayload): SemanticGraphBuildResult {
    const drafts = buildChecklistRuleDrafts(checklist)
    const entryRules = this.normalizeRules(checklist.entryRules)
    const exitRules = this.normalizeRules(checklist.exitRules)
    const riskText = this.stringifyRiskRules(checklist.riskRules)
    const ruleText = [...entryRules, ...exitRules].join(' ')
    const allText = [ruleText, riskText].join(' ')
    const primaryTimeframe = this.resolvePrimaryTimeframe(checklist, drafts, [...entryRules, ...exitRules, riskText])
    const entryDefaultTimeframe = resolveRulePhaseDefaultTimeframe(drafts.entry, primaryTimeframe) ?? primaryTimeframe
    const exitDefaultTimeframe = resolveRulePhaseDefaultTimeframe(drafts.exit, primaryTimeframe) ?? primaryTimeframe
    const symbol = this.resolveSymbol(checklist.symbols)
    const unsupportedFeatures = this.collectUnsupportedFeatures(ruleText)
    const diagnostics: string[] = []
    const nodes: Array<SemanticStrategyGraph['nodes'][number]> = []
    const actions: Array<SemanticStrategyGraph['actions'][number]> = []
    const risk: Array<SemanticStrategyGraph['risk'][number]> = []
    const openSizePct = this.resolveOpenSizePct(checklist.riskRules)

    const entryNodeIds: string[] = []
    const hasDropBuyEntry = this.appendDropBuyNodes(entryRules, drafts.entry, checklist.entryRuleBases, entryDefaultTimeframe, nodes, entryNodeIds)
    const grid = this.appendGridNodes(entryRules, exitRules, drafts.entry, drafts.exit, entryDefaultTimeframe, exitDefaultTimeframe, nodes, diagnostics)
    const bollingerSignals = this.appendBollingerNodes(allText, primaryTimeframe, nodes)
    const hasRiseExit = this.appendRiseSellNodes(exitRules, drafts.exit, checklist.exitRuleBases, exitDefaultTimeframe, nodes)
    const hasPnlExit = this.appendPositionPnlNodes(exitRules, drafts.exit, checklist.exitRuleBases, exitDefaultTimeframe, nodes)

    if (entryNodeIds.length > 1) {
      nodes.push({
        id: 'entry-logical-group-1',
        phase: 'entry',
        kind: 'logical_group',
        params: {
          join: 'AND',
          members: entryNodeIds,
        },
      })
    }

    if (bollingerSignals.hasOutsideRisk) {
      nodes.push({
        id: 'risk-bollinger-outside-3',
        phase: 'risk',
        kind: 'bollinger_bars_outside',
        params: {
          timeframe: primaryTimeframe,
          bandSide: 'outside',
          bars: 3,
          effect: 'REDUCE_POSITION',
        },
      })
    }

    this.appendRiskNodes(checklist.riskRules, risk)

    if (hasDropBuyEntry || grid.hasEntry || bollingerSignals.hasLongEntry) {
      actions.push({ id: 'action-open-long', kind: 'OPEN_LONG', sizePct: openSizePct })
    }
    if (bollingerSignals.hasShortEntry) {
      actions.push({ id: 'action-open-short', kind: 'OPEN_SHORT', sizePct: openSizePct })
    }
    if (hasRiseExit || hasPnlExit || grid.hasExit || bollingerSignals.hasMiddleExit) {
      actions.push({ id: 'action-close-long', kind: 'CLOSE_LONG', sizePct: 100 })
    }
    if (bollingerSignals.hasMiddleExit && bollingerSignals.hasShortEntry) {
      actions.push({ id: 'action-close-short', kind: 'CLOSE_SHORT', sizePct: 100 })
    }

    if (entryRules.length > 0 && !nodes.some(node => node.phase === 'entry')) {
      diagnostics.push('entry_rules_not_mapped')
    }
    if (exitRules.length > 0 && !nodes.some(node => node.phase === 'exit')) {
      diagnostics.push('exit_rules_not_mapped')
    }

    const hasOpenAction = actions.some(action => action.kind === 'OPEN_LONG' || action.kind === 'OPEN_SHORT')
    const hasCloseAction = actions.some(action => action.kind === 'CLOSE_LONG' || action.kind === 'CLOSE_SHORT')
    const graph = nodes.length > 0 && hasOpenAction && hasCloseAction
      ? {
          version: 1 as const,
          market: {
            symbol,
            primaryTimeframe,
          },
          nodes,
          actions,
          risk,
        }
      : null

    return {
      graph,
      unsupportedFeatures,
      diagnostics: [...new Set(diagnostics)],
    }
  }

  private normalizeRules(rules?: string[]): string[] {
    if (!Array.isArray(rules)) return []
    return rules.map(rule => rule.trim()).filter(Boolean)
  }

  private resolveSymbol(symbols?: string[]): string {
    if (Array.isArray(symbols) && symbols[0]?.trim()) {
      return symbols[0].trim().toUpperCase()
    }
    return 'BTCUSDT'
  }

  private resolvePrimaryTimeframe(
    checklist: ChecklistPayload,
    drafts: ReturnType<typeof buildChecklistRuleDrafts>,
    hints: string[],
  ): string {
    const defaultTimeframe = resolveChecklistDefaultTimeframe(checklist)
    if (defaultTimeframe) {
      return defaultTimeframe
    }
    const entryTimeframe = drafts.entry.find(draft => draft.timeframe)?.timeframe
    if (entryTimeframe) {
      return entryTimeframe
    }
    const exitTimeframe = drafts.exit.find(draft => draft.timeframe)?.timeframe
    if (exitTimeframe) {
      return exitTimeframe
    }
    for (const hint of hints) {
      const timeframe = this.extractTimeframe(hint)
      if (timeframe) return timeframe
    }
    return '15m'
  }

  private resolveOpenSizePct(riskRules?: Record<string, unknown>): number {
    if (typeof riskRules?.positionPct === 'number' && Number.isFinite(riskRules.positionPct) && riskRules.positionPct > 0) {
      return Math.min(100, riskRules.positionPct)
    }
    return 10
  }

  private appendRiskNodes(
    riskRules: Record<string, unknown> | undefined,
    risk: Array<SemanticStrategyGraph['risk'][number]>,
  ): void {
    if (!riskRules) return
    if (typeof riskRules.stopLossPct === 'number' && Number.isFinite(riskRules.stopLossPct) && riskRules.stopLossPct > 0) {
      risk.push({
        id: 'risk-stop-loss-pct',
        kind: 'STOP_LOSS_PCT',
        valuePct: riskRules.stopLossPct,
        effect: 'FORCE_EXIT',
      })
    }
    if (typeof riskRules.maxSingleLossPct === 'number' && Number.isFinite(riskRules.maxSingleLossPct) && riskRules.maxSingleLossPct > 0) {
      risk.push({
        id: 'risk-max-single-loss-pct',
        kind: 'MAX_SINGLE_LOSS_PCT',
        valuePct: riskRules.maxSingleLossPct,
        effect: 'BLOCK_ENTRY',
      })
    }
  }

  private appendDropBuyNodes(
    entryRules: string[],
    entryDrafts: ChecklistPayload['entryRuleDrafts'] | undefined,
    entryRuleBases: ChecklistPayload['entryRuleBases'],
    fallbackTimeframe: string,
    nodes: Array<SemanticStrategyGraph['nodes'][number]>,
    entryNodeIds: string[],
  ): boolean {
    let created = false
    for (const [index, rule] of entryRules.entries()) {
      const explicitBasis = entryDrafts?.[index]?.basis ?? this.readBasis(entryRuleBases, `entry-${index + 1}`)
      let valuePct: number | null = null
      let matched = rule.match(/当前K线收盘价相对于上一根K线收盘价下跌\s*(?:(?:≥|>=|大于等于)\s*)?(\d+(?:\.\d+)?)\s*%/u)
      if (matched?.[1]) {
        valuePct = Number(matched[1])
      } else {
        matched = rule.match(/(?:跌|下跌|回撤)\s*(?:(?:≥|>=|大于等于)\s*)?(\d+(?:\.\d+)?)\s*%/u)
        if (matched?.[1]) valuePct = Number(matched[1])
      }
      if (valuePct === null) continue
      if (!/买入|开仓|入场/u.test(rule)) continue

      const nodeId = `entry-drop-${nodes.length + 1}`
      nodes.push({
        id: nodeId,
        phase: 'entry',
        kind: 'price_change_pct',
        params: {
          timeframe: entryDrafts?.[index]?.timeframe ?? this.extractTimeframe(rule) ?? fallbackTimeframe,
          left: { source: 'close', offsetBars: 0 },
          right: { source: 'close', offsetBars: 1 },
          op: 'lte',
          valuePct: -Math.abs(valuePct),
          ...(explicitBasis ? { basis: explicitBasis } : {}),
        },
      })
      entryNodeIds.push(nodeId)
      created = true
    }
    return created
  }

  private appendRiseSellNodes(
    exitRules: string[],
    exitDrafts: ChecklistPayload['exitRuleDrafts'] | undefined,
    exitRuleBases: ChecklistPayload['exitRuleBases'],
    fallbackTimeframe: string,
    nodes: Array<SemanticStrategyGraph['nodes'][number]>,
  ): boolean {
    let created = false
    for (const [index, rule] of exitRules.entries()) {
      const explicitBasis = exitDrafts?.[index]?.basis ?? this.readBasis(exitRuleBases, `exit-${index + 1}`)
      if (explicitBasis === 'entry_avg_price' || explicitBasis === 'position_pnl') {
        continue
      }
      if (/开仓均价|收益率|盈亏|pnl/iu.test(rule)) {
        continue
      }
      const match = rule.match(/(?:涨|上涨|反弹)\s*(?:(?:≥|>=|大于等于)\s*)?(\d+(?:\.\d+)?)\s*%/u)
      if (!match?.[1]) continue
      if (!/卖出|平仓|止盈|离场|出场/u.test(rule)) continue

      nodes.push({
        id: `exit-rise-${nodes.length + 1}`,
        phase: 'exit',
        kind: 'price_change_pct',
        params: {
          timeframe: exitDrafts?.[index]?.timeframe ?? this.extractTimeframe(rule) ?? fallbackTimeframe,
          left: { source: 'close', offsetBars: 0 },
          right: { source: 'close', offsetBars: 1 },
          op: 'gte',
          valuePct: Number(match[1]),
          ...(explicitBasis ? { basis: explicitBasis } : {}),
        },
      })
      created = true
    }
    return created
  }

  private appendPositionPnlNodes(
    exitRules: string[],
    exitDrafts: ChecklistPayload['exitRuleDrafts'] | undefined,
    exitRuleBases: ChecklistPayload['exitRuleBases'],
    fallbackTimeframe: string,
    nodes: Array<SemanticStrategyGraph['nodes'][number]>,
  ): boolean {
    let created = false
    for (const [index, rule] of exitRules.entries()) {
      const explicitBasis = exitDrafts?.[index]?.basis ?? this.readBasis(exitRuleBases, `exit-${index + 1}`)
      let match = rule.match(/当前K线收盘价相对于开仓均价上涨\s*(?:(?:≥|>=|大于等于)\s*)?(\d+(?:\.\d+)?)\s*%/u)
      if (!match?.[1]) {
        match = rule.match(/(?:持仓|仓位)?[^，。；;\n]{0,12}?(?:收益率|收益|盈利|盈亏)[^，。；;\n]{0,12}?(?:达到|大于等于|>=|超过|≥)?\s*(\d+(?:\.\d+)?)\s*%/u)
      }
      if (!match?.[1] && (explicitBasis === 'entry_avg_price' || explicitBasis === 'position_pnl')) {
        match = rule.match(/(?:涨|上涨|反弹)\s*(?:(?:≥|>=|大于等于)\s*)?(\d+(?:\.\d+)?)\s*%/u)
      }
      if (!match?.[1]) continue
      if (!/止盈|平仓|卖出|离场|出场/u.test(rule)) continue

      nodes.push({
        id: `exit-pnl-${nodes.length + 1}`,
        phase: 'exit',
        kind: 'position_pnl_pct',
        params: {
          timeframe: exitDrafts?.[index]?.timeframe ?? this.extractTimeframe(rule) ?? fallbackTimeframe,
          op: 'gte',
          valuePct: Number(match[1]),
          ...(explicitBasis ? { basis: explicitBasis } : {}),
        },
      })
      created = true
    }
    return created
  }

  private readBasis(
    bases: ChecklistPayload['entryRuleBases'] | ChecklistPayload['exitRuleBases'] | undefined,
    key: string,
  ): ChecklistRuleBasis['kind'] | null {
    const value = bases?.[key]
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }

  private appendGridNodes(
    entryRules: string[],
    exitRules: string[],
    entryDrafts: ChecklistPayload['entryRuleDrafts'] | undefined,
    exitDrafts: ChecklistPayload['exitRuleDrafts'] | undefined,
    entryDefaultTimeframe: string,
    exitDefaultTimeframe: string,
    nodes: Array<SemanticStrategyGraph['nodes'][number]>,
    diagnostics: string[],
  ): { hasEntry: boolean; hasExit: boolean } {
    const entryText = entryRules.join(' ')
    const exitText = exitRules.join(' ')
    const combined = `${entryText} ${exitText}`
    if (!/网格/u.test(combined)) return { hasEntry: false, hasExit: false }

    const wantsEntry = /固定区间|网格买入|区间网格买入/u.test(entryText)
    const wantsExit = /上方网格卖出|网格卖出/u.test(exitText)
    const rangeMatch = combined.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.resolveGridStepPct(combined)
    const levelMatch = combined.match(/(?:共|总计)?\s*(\d+)\s*格/u)

    const hasCompleteParams = Boolean(rangeMatch?.[1] && rangeMatch?.[2] && stepPct !== null && levelMatch?.[1])
    if ((wantsEntry || wantsExit) && !hasCompleteParams) {
      diagnostics.push('grid_params_missing')
      return { hasEntry: false, hasExit: false }
    }

    if (!hasCompleteParams) {
      return { hasEntry: false, hasExit: false }
    }

    const rangeMin = Number(rangeMatch?.[1])
    const rangeMax = Number(rangeMatch?.[2])
    const levelCount = Number(levelMatch?.[1])

    if (wantsEntry) {
      nodes.push({
        id: `entry-grid-${nodes.length + 1}`,
        phase: 'entry',
        kind: 'grid_level_touch',
        params: {
          timeframe: entryDrafts?.[0]?.timeframe ?? this.extractTimeframe(entryText) ?? entryDefaultTimeframe,
          range: { min: rangeMin, max: rangeMax },
          stepPct,
          levelCount,
        },
      })
    }

    if (wantsExit) {
      nodes.push({
        id: `exit-grid-${nodes.length + 1}`,
        phase: 'exit',
        kind: 'grid_level_touch',
        params: {
          timeframe: exitDrafts?.[0]?.timeframe ?? this.extractTimeframe(exitText) ?? exitDefaultTimeframe,
          range: { min: rangeMin, max: rangeMax },
          stepPct,
          levelCount,
        },
      })
    }

    return { hasEntry: wantsEntry, hasExit: wantsExit }
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

  private appendBollingerNodes(
    text: string,
    fallbackTimeframe: string,
    nodes: Array<SemanticStrategyGraph['nodes'][number]>,
  ): { hasLongEntry: boolean; hasShortEntry: boolean; hasMiddleExit: boolean; hasOutsideRisk: boolean } {
    const timeframe = this.extractTimeframe(text) ?? fallbackTimeframe
    const hasUpperShort = /布林带?[^。；;\n]{0,24}上轨[^。；;\n]{0,16}(?:做空|开空)/u.test(text)
    const hasLowerLong = /布林带?[^。；;\n]{0,24}下轨[^。；;\n]{0,16}(?:做多|开多)/u.test(text)
    const hasMiddleExit = /中轨[^。；;\n]{0,16}(?:平仓|止盈|出场|离场)/u.test(text)
    const hasOutsideRisk = /连续\s*3\s*根[^。；;\n]{0,20}轨外/u.test(text) || /3\s*根[^。；;\n]{0,20}轨外/u.test(text)

    if (hasUpperShort) {
      nodes.push({
        id: `entry-boll-upper-short-${nodes.length + 1}`,
        phase: 'entry',
        kind: 'bollinger_band_touch',
        params: {
          timeframe,
          band: 'upper',
          direction: 'breakout',
          actionBias: 'short',
          period: 20,
          stdDev: 2,
        },
      })
    }

    if (hasLowerLong) {
      nodes.push({
        id: `entry-boll-lower-long-${nodes.length + 1}`,
        phase: 'entry',
        kind: 'bollinger_band_touch',
        params: {
          timeframe,
          band: 'lower',
          direction: 'breakdown',
          actionBias: 'long',
          period: 20,
          stdDev: 2,
        },
      })
    }

    if (hasMiddleExit) {
      nodes.push({
        id: `exit-boll-middle-close-${nodes.length + 1}`,
        phase: 'exit',
        kind: 'bollinger_band_touch',
        params: {
          timeframe,
          band: 'middle',
          direction: 'breakout',
          actionBias: 'long',
          period: 20,
          stdDev: 2,
        },
      })
    }

    return {
      hasLongEntry: hasLowerLong,
      hasShortEntry: hasUpperShort,
      hasMiddleExit,
      hasOutsideRisk,
    }
  }

  private collectUnsupportedFeatures(text: string): string[] {
    const normalizedForUnsupportedScan = text
      // Treat middle-band aliases like "布林带中轨(MA20)" as supported bollinger
      // semantics instead of unsupported moving-average strategies.
      .replace(
        /布林带?[^。；;\n]{0,24}中轨\s*(?:[（(]\s*)?(?:MA\s*20|20\s*(?:日|周期)?均线)\s*[)）]?/giu,
        '布林带中轨',
      )

    const unsupported = new Set<string>()
    if (/金叉|死叉|均线|EMA|MA/iu.test(normalizedForUnsupportedScan)) {
      unsupported.add('均线交叉类语义')
    }
    if (/(?:^|[^a-z])RSI(?:[^a-z]|$)|相对强弱/iu.test(normalizedForUnsupportedScan)) {
      unsupported.add('RSI 指标语义')
    }
    if (/(?:^|[^a-z])MACD(?:[^a-z]|$)|指数平滑异同/iu.test(normalizedForUnsupportedScan)) {
      unsupported.add('MACD 指标语义')
    }
    if (/(?:^|[^a-z])ATR(?:[^a-z]|$)|平均真实波幅/iu.test(normalizedForUnsupportedScan)) {
      unsupported.add('ATR 指标语义')
    }
    return [...unsupported]
  }

  private stringifyRiskRules(riskRules?: Record<string, unknown>): string {
    if (!riskRules || typeof riskRules !== 'object') return ''
    return Object.entries(riskRules)
      .map(([key, value]) => `${key}:${String(value)}`)
      .join(' ')
  }

  private extractTimeframe(text: string): string | null {
    const matched = text.match(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/iu)
    if (!matched?.[1] || !matched[2]) return null
    return this.normalizeTimeframe(matched[1], matched[2])
  }

  private normalizeTimeframe(value: string, unit: string): string {
    const normalizedUnit = unit.toLowerCase()
    if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
    if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
    return `${value}d`
  }
}
