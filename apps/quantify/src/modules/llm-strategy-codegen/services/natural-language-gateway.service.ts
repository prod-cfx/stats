import type {
  SemanticActionFrame,
  SemanticAdaptiveVolatilityGridFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticContextFrame,
  SemanticDataSourceScopeFrame,
  SemanticDynamicGridFrame,
  SemanticEventListenerFrame,
  SemanticFixedGridGatedFrame,
  SemanticIndicatorCompareFrame,
  SemanticLegScopeFrame,
  SemanticNaturalLanguageFrame,
  SemanticPortfolioDrawdownFrame,
  SemanticPortfolioSubStrategyExposureCapFrame,
  SemanticPortfolioSymbolExposureCapFrame,
  SemanticRegimeGateFrame,
  SemanticRiskFrame,
  SemanticSubStrategyGateFrame,
  SemanticSubStrategyScopeFrame,
  SemanticSymbolScopeFrame,
  SemanticTimeframeScopeFrame,
} from '../types/semantic-natural-language-frame'
import { Injectable } from '@nestjs/common'
import { parseTimeframeMs } from '@ai/shared/script-engine/compiled-runtime'
import { SUPPORTED_QUOTE_ASSETS } from '../constants/quote-assets'
import { assertSymbolWellFormed } from './execution-model-source-invariant'

/**
 * Issue #1459 闸 4 review C3：natural-language-gateway 的 `\b([A-Z]{2,5})USDT\b`
 * 正则在某些 fallback / 别名场景下可能拿到已含 quote 后缀的 base（例如别名表注入
 * 后的二次匹配，或上游 OCR 容错把 'BTCUSDT 永续' 切成 m[1]='BTCUS'+'DT?' 之类），
 * 直接 `${m[1]}USDT` 会拼出 BTCUSDTUSDT 双 quote。
 *
 * 本 helper 在拼接前剥离 m[1] 末尾可能已包含的 quote 后缀，再补 USDT；
 * 最终用 assertSymbolWellFormed 兜底，任何残留双 quote 都会被 fail-closed。
 */
function safeConcatUsdtSymbol(base: string): string {
  let normalized = base.toUpperCase()
  for (const quote of SUPPORTED_QUOTE_ASSETS) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      normalized = normalized.slice(0, normalized.length - quote.length)
      break
    }
  }
  const symbol = `${normalized}USDT`
  assertSymbolWellFormed(symbol)
  return symbol
}

type FrameDraft =
  | ContextFrameDraft
  | IndicatorCompareFrameDraft
  | BoundaryTouchFrameDraft
  | ActionFrameDraft
  | RiskFrameDraft
  | CombinationFrameDraft
  | RegimeGateFrameDraft
  | PortfolioDrawdownFrameDraft
  | PortfolioSymbolExposureCapFrameDraft
  | PortfolioSubStrategyExposureCapFrameDraft
  | FixedGridGatedFrameDraft
  | DynamicGridFrameDraft
  | AdaptiveVolatilityGridFrameDraft
  | EventListenerFrameDraft
  | SymbolScopeFrameDraft
  | LegScopeFrameDraft
  | TimeframeScopeFrameDraft
  | DataSourceScopeFrameDraft
  | SubStrategyScopeFrameDraft
  | SubStrategyGateFrameDraft

type ContextFrameDraft = Omit<SemanticContextFrame, 'id' | 'confidence'>
type IndicatorCompareFrameDraft = Omit<SemanticIndicatorCompareFrame, 'id' | 'confidence'>
type BoundaryTouchFrameDraft = Omit<SemanticBoundaryTouchFrame, 'id' | 'confidence'>
type ActionFrameDraft = Omit<SemanticActionFrame, 'id' | 'confidence'>
type RiskFrameDraft = Omit<SemanticRiskFrame, 'id' | 'confidence'>
type CombinationFrameDraft = Omit<SemanticCombinationFrame, 'id' | 'confidence'>
type RegimeGateFrameDraft = Omit<SemanticRegimeGateFrame, 'id' | 'confidence'>
type PortfolioDrawdownFrameDraft = Omit<SemanticPortfolioDrawdownFrame, 'id' | 'confidence'>
type PortfolioSymbolExposureCapFrameDraft = Omit<SemanticPortfolioSymbolExposureCapFrame, 'id' | 'confidence'>
type PortfolioSubStrategyExposureCapFrameDraft = Omit<SemanticPortfolioSubStrategyExposureCapFrame, 'id' | 'confidence'>
type FixedGridGatedFrameDraft = Omit<SemanticFixedGridGatedFrame, 'id' | 'confidence'>
type DynamicGridFrameDraft = Omit<SemanticDynamicGridFrame, 'id' | 'confidence'>
type AdaptiveVolatilityGridFrameDraft = Omit<SemanticAdaptiveVolatilityGridFrame, 'id' | 'confidence'>
type EventListenerFrameDraft = Omit<SemanticEventListenerFrame, 'id' | 'confidence'>
type SymbolScopeFrameDraft = Omit<SemanticSymbolScopeFrame, 'id' | 'confidence'>
type LegScopeFrameDraft = Omit<SemanticLegScopeFrame, 'id' | 'confidence'>
type TimeframeScopeFrameDraft = Omit<SemanticTimeframeScopeFrame, 'id' | 'confidence'>
type DataSourceScopeFrameDraft = Omit<SemanticDataSourceScopeFrame, 'id' | 'confidence'>
type SubStrategyScopeFrameDraft = Omit<SemanticSubStrategyScopeFrame, 'id' | 'confidence'>
type SubStrategyGateFrameDraft = Omit<SemanticSubStrategyGateFrame, 'id' | 'confidence'>

@Injectable()
export class NaturalLanguageGatewayService {
  parse(input?: string): SemanticNaturalLanguageFrame[] {
    const text = this.normalizeInput(input)
    if (!text) return []

    const drafts: FrameDraft[] = [
      ...this.parseContext(text),
      ...this.parseSymbolScope(text),
      ...this.parseLegScope(text),
      ...this.parseTimeframeScope(text),
      ...this.parseDataSourceScope(text),
      ...this.parseSubStrategyScope(text),
      ...this.parseSubStrategyGate(text),
      ...this.parseEmaGates(text),
      ...this.parseBoundaryTouches(text),
      ...this.parseActions(text),
      ...this.parseRisk(text),
      ...this.parseRegimeGate(text),
      ...this.parsePortfolioDrawdown(text),
      ...this.parsePortfolioExposureCap(text),
      ...this.parseDynamicGrid(text),
      ...this.parseAdaptiveVolatilityGrid(text),
      ...this.parseEventListener(text),
      ...this.parseFixedGridGated(text),
    ]

    // Phase 5 S11 (#1112): leg_scope 命中时 suppress 同 utterance 的 symbol_scope frame
    //   - leg_scope 已隐含双 symbol 维度（每 leg 自带 instrumentSymbol），无需 symbol_scope 重复表达
    //   - normalizer 会按 leg.instrumentSymbol 各自创建独立 scope.symbol node
    const hasLegFrame = drafts.some((d) => d.kind === 'leg_scope')
    const filtered = hasLegFrame
      ? drafts.filter((d) => d.kind !== 'symbol_scope')
      : drafts

    return filtered.map((draft, index) => ({
      ...draft,
      id: `natural-language-frame-${index + 1}`,
      confidence: 0.9,
    }))
  }

  /**
   * Phase 5 S11 (#1112): 多腿 scope.leg utterance parser
   *
   * 双门槛：
   *   1) 触发短语精准多 OR：对冲/多空/做多.做空/做空.做多/hedge/long.short/short.long/多腿/腿/leg
   *   2) ≥2 distinct (direction, symbol) 对（单方向多 symbol 不命中 leg；归 S2 symbol scope 兜底）
   *
   * 命中表（plan §3.6 锁定）：F1-F6 + 1 negative
   */
  private parseLegScope(text: string): LegScopeFrameDraft[] {
    const triggerPattern = /(对冲|多空|做多.{0,16}做空|做空.{0,16}做多|hedge|long.{0,8}short|short.{0,8}long|多腿|腿|leg)/iu
    if (!triggerPattern.test(text)) return []

    const aliasMap: Record<string, string> = {
      BTC: 'BTCUSDT',
      ETH: 'ETHUSDT',
      SOL: 'SOLUSDT',
      BNB: 'BNBUSDT',
      MATIC: 'MATICUSDT',
      AVAX: 'AVAXUSDT',
      DOGE: 'DOGEUSDT',
      XRP: 'XRPUSDT',
    }

    interface ParsedLeg {
      direction: 'long' | 'short'
      symbol: string
      pos: number  // direction keyword 在原 text 中的起点位置
      sizing?: { mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio'; value: number }
    }

    // direction keyword 全文扫描：位置 + 方向
    const directionPattern = /(做多|开多|多头|多\s|long\b|做空|开空|空头|空\s|short\b)/giu
    const directionHits: Array<{ pos: number; direction: 'long' | 'short' }> = []
    for (const m of text.matchAll(directionPattern)) {
      const matched = (m[1] ?? '').trim().toLowerCase()
      let direction: 'long' | 'short' | null = null
      if (matched === '做多' || matched === '开多' || matched === '多头' || matched === '多' || matched === 'long') direction = 'long'
      else if (matched === '做空' || matched === '开空' || matched === '空头' || matched === '空' || matched === 'short') direction = 'short'
      if (direction !== null && m.index !== undefined) {
        directionHits.push({ pos: m.index, direction })
      }
    }
    if (directionHits.length === 0) return []

    // 全文扫描所有 symbol 候选：显式 USDT + alias，记录位置
    const symbolHits: Array<{ pos: number; symbol: string }> = []
    for (const m of text.matchAll(/\b([A-Z]{2,5})USDT\b/giu)) {
      if (m.index !== undefined) symbolHits.push({ pos: m.index, symbol: safeConcatUsdtSymbol(m[1]) })
    }
    for (const m of text.matchAll(/(?<![A-Za-z])(BTC|ETH|SOL|BNB|MATIC|AVAX|DOGE|XRP)(?![A-Za-z])/giu)) {
      if (m.index === undefined) continue
      const upper = m[1].toUpperCase()
      const mapped = aliasMap[upper]
      if (!mapped) continue
      // 跳过已被显式 USDT 命中覆盖的 alias 位置
      if (symbolHits.some((s) => Math.abs(s.pos - m.index!) < 4)) continue
      symbolHits.push({ pos: m.index, symbol: mapped })
    }
    if (symbolHits.length === 0) return []

    // 每个 direction 命中向后查找最邻近的 symbol（窗口 ≤ 30 字符；若无则向前找）
    const usedSymbolPositions = new Set<number>()
    const legs: ParsedLeg[] = []
    for (const dh of directionHits) {
      // 优先向后找未占用的最近 symbol
      const forward = symbolHits
        .filter((s) => !usedSymbolPositions.has(s.pos) && s.pos >= dh.pos && s.pos - dh.pos <= 30)
        .sort((a, b) => (a.pos - dh.pos) - (b.pos - dh.pos))[0]
      let pick = forward
      if (!pick) {
        // 向前找
        const backward = symbolHits
          .filter((s) => !usedSymbolPositions.has(s.pos) && s.pos < dh.pos && dh.pos - s.pos <= 30)
          .sort((a, b) => (dh.pos - a.pos) - (dh.pos - b.pos))[0]
        pick = backward
      }
      if (!pick) continue
      usedSymbolPositions.add(pick.pos)

      // sizing：在 ±30 字符窗口内查找 quote/pct
      const winStart = Math.max(0, Math.min(dh.pos, pick.pos) - 5)
      const winEnd = Math.min(text.length, Math.max(dh.pos, pick.pos) + 30)
      const window = text.slice(winStart, winEnd)
      const quoteMatch = /(\d+(?:\.\d+)?)\s*(?:U|USDT|usdt)\b/iu.exec(window)
      const pctMatch = /(\d+(?:\.\d+)?)\s*(?:%|％|百分点)/iu.exec(window)
      let sizing: ParsedLeg['sizing']
      if (quoteMatch) {
        const value = Number(quoteMatch[1])
        if (Number.isFinite(value) && value > 0) sizing = { mode: 'fixed_quote', value }
      } else if (pctMatch) {
        const value = Number(pctMatch[1])
        if (Number.isFinite(value) && value > 0) sizing = { mode: 'fixed_pct', value }
      }

      legs.push({ direction: dh.direction, symbol: pick.symbol, pos: dh.pos, ...(sizing ? { sizing } : {}) })
    }

    // 双门槛 #2：≥2 distinct (direction, symbol) 对
    const distinctKeys = new Set(legs.map((l) => `${l.direction}|${l.symbol}`))
    if (distinctKeys.size < 2) return []

    // 等比对冲检测：trigger 含"等比对冲"且 leg 中存在 long+short 对 → fixed_ratio 1:1
    const hasEqualRatioHedge = /(?:等比对冲|delta\s*neutral|1\s*:\s*1)/iu.test(text)
    const hasExplicitRatio = /(\d+)\s*:\s*(\d+)/u.exec(text)
    const ratioPair = hasExplicitRatio
      ? { a: Number(hasExplicitRatio[1]), b: Number(hasExplicitRatio[2]) }
      : undefined

    const finalLegs: SemanticLegScopeFrame['legs'][number][] = legs.map((leg, idx) => {
      const legId = `leg.${leg.direction}.${leg.symbol.replace(/USDT$/iu, '').toLowerCase()}`
      const base: SemanticLegScopeFrame['legs'][number] = {
        legId,
        direction: leg.direction,
        instrumentSymbol: leg.symbol,
      }
      if (leg.sizing) {
        return { ...base, sizing: leg.sizing }
      }
      // 等比对冲：long/short 各一时给 fixed_ratio
      if ((hasEqualRatioHedge || ratioPair) && legs.length === 2) {
        const otherIdx = idx === 0 ? 1 : 0
        const other = legs[otherIdx]
        if (other.direction !== leg.direction) {
          const otherLegId = `leg.${other.direction}.${other.symbol.replace(/USDT$/iu, '').toLowerCase()}`
          const value = ratioPair
            ? (idx === 0 ? ratioPair.a / Math.max(ratioPair.b, 1) : ratioPair.b / Math.max(ratioPair.a, 1))
            : 1
          return {
            ...base,
            sizing: { mode: 'fixed_ratio', value, pairedLegId: otherLegId },
          }
        }
      }
      return base
    })

    return [{
      kind: 'leg_scope',
      legs: finalLegs,
      evidenceText: text.slice(0, Math.min(text.length, 80)),
    }]
  }

  private normalizeInput(input?: string): string {
    return (input ?? '').replace(/\s+/gu, ' ').trim()
  }

  private toClauses(text: string): string[] {
    return text
      .split(/[；;。]/u)
      .map(clause => clause.trim())
      .filter(clause => clause.length > 0)
  }

  private toActionSegments(text: string): string[] {
    return text
      .split(/[；;。，,]/u)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0)
  }

  private parseContext(text: string): ContextFrameDraft[] {
    const frames: ContextFrameDraft[] = []

    const timeframeMatch = /(?:^|[^\d])(15\s*(?:min|m|分钟))/iu.exec(text)
    if (timeframeMatch) {
      frames.push({
        kind: 'context',
        field: 'timeframe',
        value: '15m',
        evidenceText: timeframeMatch[1],
      })
    }

    const exchangeMatch = /(币安|binance)/iu.exec(text)
    if (exchangeMatch) {
      frames.push({
        kind: 'context',
        field: 'exchange',
        value: 'binance',
        evidenceText: exchangeMatch[0],
      })
    }

    const symbolMatch = /\bBTC\s*[/ -]?\s*USDT\b/iu.exec(text)
    if (symbolMatch) {
      frames.push({
        kind: 'context',
        field: 'symbol',
        value: 'BTCUSDT',
        evidenceText: symbolMatch[0],
      })
    }

    const marketTypeMatch = /(永续|合约|perp|swap|现货|spot)/iu.exec(text)
    if (marketTypeMatch) {
      frames.push({
        kind: 'context',
        field: 'marketType',
        value: /现货|spot/iu.test(marketTypeMatch[0]) ? 'spot' : 'perp',
        evidenceText: marketTypeMatch[0],
      })
    }

    return frames
  }

  private parseEmaGates(text: string): Array<IndicatorCompareFrameDraft | CombinationFrameDraft> {
    const frames: Array<IndicatorCompareFrameDraft | CombinationFrameDraft> = []

    for (const clause of this.toClauses(text)) {
      const emaBlocks = this.findEmaBlocks(clause)
      if (emaBlocks.length === 0) continue

      for (const emaBlock of emaBlocks) {
        if (this.hasEmaGate(clause, emaBlock, '上方', ['只开多', '开多', '做多'])) {
          frames.push(...this.toEmaCompareFrames(emaBlock.periods, 'GT', 'long', 'ema-gate-long', emaBlock.evidenceText))
          frames.push({
            kind: 'combination',
            groupId: 'ema-gate-long',
            join: 'AND',
            sideScope: 'long',
            evidenceText: emaBlock.evidenceText,
          })
        }

        if (this.hasEmaGate(clause, emaBlock, '下方', ['只开空', '开空', '做空'])) {
          frames.push(...this.toEmaCompareFrames(emaBlock.periods, 'LT', 'short', 'ema-gate-short', emaBlock.evidenceText))
          frames.push({
            kind: 'combination',
            groupId: 'ema-gate-short',
            join: 'AND',
            sideScope: 'short',
            evidenceText: emaBlock.evidenceText,
          })
        }
      }
    }

    return frames
  }

  private findEmaBlocks(text: string): Array<{ periods: number[], evidenceText: string, index: number }> {
    return Array.from(text.matchAll(/((?:\bema\s*\d+\b[\s,，、]*){2,})(?=[^。；;,，]*[上下]方)/giu))
      .map((match) => {
        const evidenceText = match[1].trim()
        const periods = Array.from(evidenceText.matchAll(/\bema\s*(\d+)\b/giu)).map(item => Number(item[1]))
        return {
          periods,
          evidenceText,
          index: match.index ?? 0,
        }
      })
      .filter(block => block.periods.length > 0)
  }

  private hasEmaGate(
    clause: string,
    emaBlock: { evidenceText: string, index: number },
    directionText: '上方' | '下方',
    actionTexts: string[],
  ): boolean {
    const blockIndex = emaBlock.index
    if (blockIndex < 0) return false

    const localText = this.takeUntilNextIndicator(clause.slice(blockIndex + emaBlock.evidenceText.length))
    if (!localText.includes(directionText)) return false

    return actionTexts.some((actionText) => {
      const localActionIndex = localText.indexOf(actionText)
      if (localActionIndex < 0) return false

      const concreteActionMatchIndex = blockIndex + emaBlock.evidenceText.length + localActionIndex
      return this.isAffirmativeActionAt(clause, concreteActionMatchIndex)
    })
  }

  private takeUntilNextIndicator(text: string): string {
    return text.split(/[,，]|\b(?:ema|ma|sma|rsi|macd|kdj|boll)\b|布林带?/iu)[0]
  }

  private toEmaCompareFrames(
    periods: number[],
    operator: SemanticIndicatorCompareFrame['operator'],
    sideScope: SemanticIndicatorCompareFrame['sideScope'],
    groupId: string,
    evidenceText: string,
  ): IndicatorCompareFrameDraft[] {
    return periods.map(period => ({
      kind: 'indicator_compare',
      indicator: 'ema',
      period,
      operator,
      sideScope,
      groupId,
      evidenceText: `ema${period}`,
    }))
  }

  private parseBoundaryTouches(text: string): BoundaryTouchFrameDraft[] {
    const frames: BoundaryTouchFrameDraft[] = []
    let canInheritBollinger = false

    for (const clause of this.toClauses(text)) {
      const clauseFrames = this.parseBoundaryTouchClause(clause, canInheritBollinger)
      frames.push(...clauseFrames)
      canInheritBollinger = clauseFrames.some(frame =>
        frame.indicator === 'bollinger'
        && /^(?:boll|布林带?)/iu.test(frame.evidenceText),
      )
    }

    return frames
  }

  private parseBoundaryTouchClause(clause: string, canInheritBollinger = false): BoundaryTouchFrameDraft[] {
    const frames: BoundaryTouchFrameDraft[] = []
    const lowerMatch = /(boll|布林带?)\s*下轨\s*(?:不要|禁止|不)?\s*(开多|做多|买入)/iu.exec(clause)
    const upperMatch = /(boll|布林带?)\s*上轨\s*(?:不要|禁止|不)?\s*(开空|做空|卖空)/iu.exec(clause)
    const inheritedUpperMatch = /(?:^|[\s,，])上轨\s*(?:不要|禁止|不)?\s*(开空|做空|卖空)/iu.exec(clause)
    const canInheritLocalBollinger = canInheritBollinger || Boolean(lowerMatch)

    if (
      lowerMatch
      && this.isAffirmativeActionAt(clause, this.concreteActionMatchIndex(lowerMatch, 2))
    ) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'lower',
        sideScope: 'long',
        phase: 'entry',
        evidenceText: lowerMatch[0].trim(),
      })
    }

    if (
      upperMatch
      && this.isAffirmativeActionAt(clause, this.concreteActionMatchIndex(upperMatch, 2))
    ) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'upper',
        sideScope: 'short',
        phase: 'entry',
        evidenceText: upperMatch[0].trim(),
      })
      return frames
    }

    if (
      canInheritLocalBollinger
      && inheritedUpperMatch
      && this.isAffirmativeActionAt(clause, this.concreteActionMatchIndex(inheritedUpperMatch, 1))
    ) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'upper',
        sideScope: 'short',
        phase: 'entry',
        evidenceText: inheritedUpperMatch[0].replace(/^[\s,，]+/u, '').trim(),
      })
    }

    return frames
  }

  private parseActions(text: string): ActionFrameDraft[] {
    const frames: ActionFrameDraft[] = []

    for (const segment of this.toActionSegments(text)) {
      const openLongMatch = /(开多|做多|买入)/u.exec(segment)
      if (openLongMatch && this.isAffirmativeActionAt(segment, openLongMatch.index)) {
        frames.push({
          kind: 'action',
          actionKey: 'open_long',
          evidenceText: openLongMatch[0],
        })
      }

      const openShortMatch = /(卖出开空|开空|做空|卖空)/u.exec(segment)
      if (openShortMatch && this.isAffirmativeActionAt(segment, openShortMatch.index)) {
        frames.push({
          kind: 'action',
          actionKey: 'open_short',
          evidenceText: openShortMatch[0],
        })
      }
    }

    return frames
  }

  private concreteActionMatchIndex(match: RegExpExecArray, actionGroupIndex: number): number {
    const actionText = match[actionGroupIndex]
    return match.index + match[0].lastIndexOf(actionText)
  }

  private isAffirmativeActionAt(text: string, concreteActionMatchIndex: number): boolean {
    const segmentStart = Math.max(
      text.lastIndexOf('，', concreteActionMatchIndex - 1),
      text.lastIndexOf(',', concreteActionMatchIndex - 1),
      text.lastIndexOf('；', concreteActionMatchIndex - 1),
      text.lastIndexOf(';', concreteActionMatchIndex - 1),
      text.lastIndexOf('。', concreteActionMatchIndex - 1),
    ) + 1
    const prefix = text.slice(segmentStart, concreteActionMatchIndex)
    return !/(不要|禁止|不)/u.test(prefix)
  }

  private parseRisk(text: string): RiskFrameDraft[] {
    const match = /亏损\s*(?:百分之?|%?\s*)?(\d+(?:\.\d+)?)\s*%?\s*止损/u.exec(text)
    if (!match) return []

    const valuePct = Number(match[1])
    if (valuePct <= 0 || valuePct >= 100) return []

    return [
      {
        kind: 'risk',
        riskKey: 'risk.stop_loss_pct',
        valuePct,
        evidenceText: match[0],
      },
    ]
  }

  /**
   * Phase 5 S2 (#1104): 多标的 scope.symbol utterance parser
   *
   * 双门槛：
   *   1. ≥2 个 distinct symbol（USDT 后缀正则 + 中文别名白名单）
   *   2. 触发短语精准多 OR 命中（避免"和"/"与"高频汉字误命中）
   *
   * 命中表（plan T7 step 3）：
   *   - "BTCUSDT 和 ETHUSDT 同时跑相同策略" → "同时" + "跑相同"
   *   - "在 BTC 和 ETH 上挂网格" → "挂网格"
   *   - "BTCUSDT、ETHUSDT、SOLUSDT 多个标的同时跑" → "多个标的" + "同时"
   *   - "BTCUSDT 主标的，ETHUSDT 跟随" → "主标的" + "跟随"
   *   - "Run BTCUSDT and ETHUSDT in parallel" → "in parallel"
   *   - "跨标的（BTC/ETH/BNB）均挂网格" → "跨标的" + "挂网格"
   */
  private parseSymbolScope(text: string): SymbolScopeFrameDraft[] {
    // (1) 触发短语精准多 OR
    const triggerPattern = /(同时|分别|各自|都挂|都跑|都用|挂网格|跑相同|跟随|主标的|多个标的|跨标的|多币种|in parallel|simultaneously|both)/iu
    if (!triggerPattern.test(text)) return []

    // (2) symbol 提取
    const aliasMap: Record<string, string> = {
      BTC: 'BTCUSDT',
      ETH: 'ETHUSDT',
      SOL: 'SOLUSDT',
      BNB: 'BNBUSDT',
      MATIC: 'MATICUSDT',
      AVAX: 'AVAXUSDT',
      DOGE: 'DOGEUSDT',
      XRP: 'XRPUSDT',
    }
    const symbolSet = new Set<string>()
    // 显式 USDT 后缀（要求完整 USDT；BTCUS 不命中）
    const explicit = /\b([A-Z]{2,5})USDT\b/gu
    for (const m of text.matchAll(explicit)) {
      const symbol = safeConcatUsdtSymbol(m[1])
      symbolSet.add(symbol)
    }
    // 中文别名白名单（避免与显式 USDT 命中冲突）
    const alias = /(?<![A-Za-z])(BTC|ETH|SOL|BNB|MATIC|AVAX|DOGE|XRP)(?![A-Za-z])/giu
    for (const m of text.matchAll(alias)) {
      const upper = m[1].toUpperCase()
      const mapped = aliasMap[upper]
      if (mapped) symbolSet.add(mapped)
    }

    if (symbolSet.size < 2) return []
    const symbols = [...symbolSet].sort()

    // (3) primarySymbol 提取（仅当 utterance 显式声明）
    //   前置形式："主标的 BTCUSDT" / "主标的：BTC" / "primary BTCUSDT"
    //   后置形式："BTCUSDT 主标的" / "BTCUSDT 是主标的" / "BTCUSDT primary"（#1135）
    //   两式都先后尝试，前置优先。
    const primaryPrefix = /(?:主标的|primary)\s*[:：是为]?\s*[（(]?\s*([A-Z]{2,5})USDT?/iu
    const primaryPostfix = /([A-Z]{2,5})USDT?\s*(?:为|是)?\s*(?:主标的|primary)/iu
    const primaryMatch = primaryPrefix.exec(text) ?? primaryPostfix.exec(text)
    const primaryRaw = primaryMatch ? `${primaryMatch[1].toUpperCase()}USDT` : undefined
    const primarySymbol = primaryRaw && symbolSet.has(primaryRaw) ? primaryRaw : undefined

    return [{
      kind: 'symbol_scope',
      symbols,
      ...(primarySymbol ? { primarySymbol } : {}),
      evidenceText: text.slice(0, Math.min(text.length, 80)),
    }]
  }

  /**
   * Phase 5 S3 (#1109): scope.timeframe utterance parser
   *
   * 双门槛（critic Round 1 M2 / Round 2 修正）：
   *   1. 至少 2 个 distinct timeframe vocab 命中（vocab 由 packages/shared TIMEFRAME_MS 派生）
   *   2. 触发短语精准多 OR——锁定 scope-binding 词组，移除与 strategy.multi_timeframe atom 撞车的
   *      "高周期"/"低周期"/"周期过滤"/"多周期"等高频汉字
   *
   * 默认 alignmentPolicy = 'strict'（critic Round 1 C4：与 fail-closed 主张一致）；
   * utterance 显式 "宽松对齐"/"tolerant alignment" 才落 'tolerant'。
   *
   * 命中 6 fixture（plan §4.9.1）：
   *   F1 "用 15m 主周期，1h 和 4h 做 scope 依赖周期"
   *   F2 "Primary timeframe 15m, required timeframes 1h and 4h"
   *   F3 "执行周期 5m，依赖周期 15m 1h 严格对齐"
   *   F4 "主周期 1h，依赖周期 4h 1d 宽松对齐"
   *   F5 "Multi-timeframe scope: primary 5m, required 15m + 1h"
   *   F6 "执行 15m，多时间框架 scope 1h + 4h，strict alignment"
   * Negative：N1 单周期 / N2 HTF filter atom utterance / N3 symbol_scope utterance 不命中
   */
  private parseTimeframeScope(text: string): TimeframeScopeFrameDraft[] {
    // (1) 触发短语精准多 OR — 锁定 scope-binding 词组
    const triggerPattern = /(主周期|执行周期|主时间框架|primary\s+timeframe|primary\s+tf|多时间框架\s*scope|multi[-\s]?timeframe\s+scope|严格对齐|strict\s+alignment|宽松对齐|tolerant\s+alignment|loose\s+alignment|require[ds]?\s+timeframes?|依赖周期)/iu
    if (!triggerPattern.test(text)) return []

    // (2) timeframe vocab 提取（与 packages/shared TIMEFRAME_MS 单一 source-of-truth）
    const tfPattern = /\b(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)\b/giu
    const distinctTfs = new Set<string>()
    const orderedTfs: string[] = []
    for (const m of text.matchAll(tfPattern)) {
      const tf = m[1].toLowerCase()
      if (!distinctTfs.has(tf)) {
        distinctTfs.add(tf)
        orderedTfs.push(tf)
      }
    }
    if (distinctTfs.size < 2) return []

    // (3) primary 提取：优先显式声明
    const primaryExplicit = /(?:主周期|执行周期|主时间框架|primary\s+(?:timeframe|tf)|执行)\s*[:：是为]?\s*[（(]?\s*(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)/iu
      .exec(text)
    let primaryTimeframe = primaryExplicit?.[1]?.toLowerCase()
    if (!primaryTimeframe || !distinctTfs.has(primaryTimeframe)) {
      // 缺显式声明 → 选最细粒度（min ms）
      let minMs = Number.POSITIVE_INFINITY
      let candidate = ''
      for (const tf of distinctTfs) {
        const ms = parseTimeframeMs(tf)
        if (ms !== null && ms < minMs) {
          minMs = ms
          candidate = tf
        }
      }
      if (!candidate) return []
      primaryTimeframe = candidate
    }

    // (4) requiredTimeframes = 总 set 减 primary，按 ms 升序
    const requiredTimeframes = orderedTfs.filter((tf) => tf !== primaryTimeframe)
    if (requiredTimeframes.length === 0) return []
    requiredTimeframes.sort((a, b) => (parseTimeframeMs(a) ?? 0) - (parseTimeframeMs(b) ?? 0))

    // (5) 粒度顺序前置（与 readiness A2.4f 一致；非法 utterance 不产 frame）
    const primaryMs = parseTimeframeMs(primaryTimeframe)
    if (primaryMs === null) return []
    const minRequiredMs = Math.min(...requiredTimeframes.map((tf) => parseTimeframeMs(tf) ?? Number.POSITIVE_INFINITY))
    if (!Number.isFinite(minRequiredMs) || primaryMs >= minRequiredMs) return []

    // (6) alignmentPolicy 提取（默认 strict；utterance 显式 tolerant 才放宽）
    const tolerantMatch = /(宽松对齐|tolerant\s+alignment|loose\s+alignment)/iu.test(text)
    const strictMatch = /(严格对齐|strict\s+alignment)/iu.test(text)
    const alignmentPolicy: 'strict' | 'tolerant' = tolerantMatch && !strictMatch ? 'tolerant' : 'strict'

    return [{
      kind: 'timeframe_scope',
      primaryTimeframe,
      requiredTimeframes,
      alignmentPolicy,
      evidenceText: text.slice(0, Math.min(text.length, 80)),
    }]
  }

  /**
   * Phase 5 S9 (#1110): scope.dataSource utterance parser
   *
   * 双门槛（critic round 1 C3 修复 — 与 S2 parseSymbolScope 互斥/共存声明）:
   *   1) 触发短语精准多 OR
   *   2) feedId 至少 1 个（venue 路径 OR webhook 命名空间，**全小写**）
   *
   * 说明：
   *   - venue 路径全小写正则与 S2 大写 `\b([A-Z]{2,5})USDT\b` 互斥不撞
   *   - utterance 同时含 S2 + S9 触发短语 + symbols + feedId 时，两 frame 共存合法
   *   - role/schemaRef 任一推断失败 → 不写 frame（让 readiness fail-closed 提示用户补全）
   */
  private parseDataSourceScope(text: string): DataSourceScopeFrameDraft[] {
    // (1) 触发短语精准多 OR
    const triggerPattern = /(数据源|行情源|主源|确认源|事件源|primary feed|confirmation feed|event source|external signal|webhook|外部信号|主行情|辅源|次源)/iu
    if (!triggerPattern.test(text)) return []

    // (2) feedId 提取（双轨）
    const venueRe = /\b(binance|okx|bybit|coinbase|hyperliquid)\.(spot|perp|futures)\.[a-z0-9]+\b/giu
    const webhookRe = /\bwebhook\.[a-z0-9][a-z0-9_.-]*\b/giu

    const feedIdSet = new Set<string>()
    for (const m of text.matchAll(venueRe)) feedIdSet.add(m[0].toLowerCase())
    for (const m of text.matchAll(webhookRe)) feedIdSet.add(m[0].toLowerCase())
    if (feedIdSet.size === 0) return []  // critic m4：trigger 命中但 feedId 提取空 → 不写 frame

    // (3) clause-level 拆分：以分号/逗号/句号切分，逐 clause 决定 role + feedId 配对
    const clauses = text.split(/[；;。，,]/u).map(c => c.trim()).filter(c => c.length > 0)
    const drafts: DataSourceScopeFrameDraft[] = []
    const usedFeedIds = new Set<string>()

    for (const clause of clauses) {
      const role = this.detectDataSourceRole(clause)
      if (!role) continue
      // 在 clause 内匹配 feedId
      let feedId = ''
      for (const m of clause.matchAll(venueRe)) {
        const candidate = m[0].toLowerCase()
        if (!usedFeedIds.has(candidate)) {
          feedId = candidate
          break
        }
      }
      if (feedId === '') {
        for (const m of clause.matchAll(webhookRe)) {
          const candidate = m[0].toLowerCase()
          if (!usedFeedIds.has(candidate)) {
            feedId = candidate
            break
          }
        }
      }
      if (feedId === '') continue
      const schemaRef = this.detectDataSourceSchemaRef(clause, role)
      if (!schemaRef) continue
      usedFeedIds.add(feedId)
      drafts.push({
        kind: 'data_source_scope',
        role,
        feedId,
        schemaRef,
        evidenceText: clause.slice(0, Math.min(clause.length, 80)),
      })
    }

    return drafts
  }

  private detectDataSourceRole(text: string): SemanticDataSourceScopeFrame['role'] | null {
    if (/(主行情|主源|primary)/iu.test(text)) return 'primary'
    if (/(确认|confirmation|辅源|次源|辅|次)/iu.test(text)) return 'confirmation'
    if (/(事件源|event source|webhook|外部信号|事件)/iu.test(text)) return 'event'
    return null
  }

  private detectDataSourceSchemaRef(text: string, role: SemanticDataSourceScopeFrame['role']): SemanticDataSourceScopeFrame['schemaRef'] | null {
    if (/(K线|OHLC|ohlcv)/iu.test(text)) return 'ohlcv'
    if (/(订单簿|orderbook)/iu.test(text)) return 'orderbook'
    if (/(清算|liquidation)/iu.test(text)) return 'liquidation'
    if (role === 'event') return 'webhook_event'
    return null
  }

  /**
   * Phase 5 S10 (#1111): parseSubStrategyScope（双门槛）
   *   1) 触发短语命中（plan §9.1 精准多 OR + 边界 `(?<![好不太能可])策略\s?[ABab](?![的人])`）
   *   2) ≥2 distinct subStrategyId 候选（白名单：策略A/B / 趋势子策略 / 震荡子策略 / sub-strategy A/B）
   * 命中后 emit 一组 sub_strategy_scope frames（每个 candidate 一个）
   * 不写默认 positionHandling/orderHandling — 缺失由 readiness fail-closed 负责
   */
  private parseSubStrategyScope(text: string): SubStrategyScopeFrameDraft[] {
    // (1) 触发短语精准多 OR
    const triggerCore = /(子策略|两套策略|分阶段策略|趋势子策略|震荡子策略|sub[\s-]?strategy|两个策略|多策略切换|策略切换)/iu
    // 边界 — "策略 A/B" 必须无负向前缀（好/不/太/能/可）+ 无负向后缀（的/人）
    const triggerStrategyAB = /(?<![好不太能可])策略\s?[ABab](?![的人])/u
    if (!triggerCore.test(text) && !triggerStrategyAB.test(text)) return []

    // (2) 候选收集（白名单 → stable id + label）
    const candidates = new Map<string, { id: string; label: string }>()
    if (/趋势子策略|趋势策略/u.test(text)) {
      candidates.set('trend_sub', { id: 'trend_sub', label: '趋势子策略' })
    }
    if (/震荡子策略|震荡策略|盘整子策略/u.test(text)) {
      candidates.set('range_sub', { id: 'range_sub', label: '震荡子策略' })
    }
    // 策略 A / 策略 B（边界已在上面保护）
    if (/(?<![好不太能可])策略\s?[Aa](?![的人])/u.test(text)) {
      candidates.set('sub_a', { id: 'sub_a', label: '策略 A' })
    }
    if (/(?<![好不太能可])策略\s?[Bb](?![的人])/u.test(text)) {
      candidates.set('sub_b', { id: 'sub_b', label: '策略 B' })
    }
    // sub-strategy A / B（英文）
    const enSubA = /sub[\s-]?strategy\s*A\b/iu.test(text)
    const enSubB = /sub[\s-]?strategy\s*B\b/iu.test(text)
    if (enSubA) candidates.set('sub_a', { id: 'sub_a', label: 'sub-strategy A' })
    if (enSubB) candidates.set('sub_b', { id: 'sub_b', label: 'sub-strategy B' })

    if (candidates.size < 2) return []

    // (3) handling 字段（仅当 utterance 显式声明）
    let positionHandling: 'close' | 'keep' | undefined
    let orderHandling: 'cancel' | 'keep' | undefined
    if (/(切换时|切到时)\s*(平|关闭|清).{0,4}(仓位|持仓|旧仓)/iu.test(text) || /平掉旧仓位|平掉旧仓/u.test(text)) {
      positionHandling = 'close'
    } else if (/(切换时|切到时)\s*(保留|不平).{0,4}(仓位|持仓)/iu.test(text)) {
      positionHandling = 'keep'
    }
    if (/(切换时|切到时)\s*(取消|cancel).{0,4}(挂单|订单|order)/iu.test(text)) {
      orderHandling = 'cancel'
    } else if (/(切换时|切到时)\s*(保留)\s*(挂单|订单)/iu.test(text)) {
      orderHandling = 'keep'
    }

    const frames: SubStrategyScopeFrameDraft[] = []
    for (const cand of candidates.values()) {
      frames.push({
        kind: 'sub_strategy_scope',
        subStrategyId: cand.id,
        subStrategyLabel: cand.label,
        ...(positionHandling ? { positionHandlingOnDeactivate: positionHandling } : {}),
        ...(orderHandling ? { orderHandlingOnDeactivate: orderHandling } : {}),
        evidenceText: text.slice(0, Math.min(text.length, 80)),
      })
    }
    return frames
  }

  /**
   * Phase 5 S10 (#1111): parseSubStrategyGate
   *   utterance 含 "切换 / 切到 X 时" + "暂停 Y" → pause_substrategy
   *   utterance 含 "X 时切到 Y" → switch_substrategy（toSubStrategyScopeRef）
   *   不主动绑定 subStrategyScopeRef — 留 normalizer 配合上下文唯一 anaphora 兜底
   */
  private parseSubStrategyGate(text: string): SubStrategyGateFrameDraft[] {
    const frames: SubStrategyGateFrameDraft[] = []
    // pause: "暂停|停用 + 子策略 X"
    const pausePattern = /(?:暂停|停用|关闭)\s*(?:子)?策略\s*([ABab])/u
    const pauseMatch = pausePattern.exec(text)
    if (pauseMatch) {
      const refId = pauseMatch[1].toLowerCase() === 'a' ? 'sub_a' : 'sub_b'
      frames.push({
        kind: 'sub_strategy_gate',
        subStrategyScopeRef: refId,
        effectWhenFalse: 'pause_substrategy',
        evidenceText: pauseMatch[0],
      })
    }
    // switch: "切到 X" / "切换至 X"
    const switchPattern = /(?:切到|切换至|切换到)\s*(?:子)?策略\s*([ABab])/u
    const switchMatch = switchPattern.exec(text)
    if (switchMatch) {
      const toRef = switchMatch[1].toLowerCase() === 'a' ? 'sub_a' : 'sub_b'
      const fromRef = toRef === 'sub_a' ? 'sub_b' : 'sub_a'
      frames.push({
        kind: 'sub_strategy_gate',
        subStrategyScopeRef: fromRef,
        toSubStrategyScopeRef: toRef,
        effectWhenFalse: 'switch_substrategy',
        evidenceText: switchMatch[0],
      })
    }
    return frames
  }

  private parseRegimeGate(text: string): RegimeGateFrameDraft[] {
    const frames: RegimeGateFrameDraft[] = []
    const pattern = /价格\s*(高于|低于)\s*(ema|sma|ma)\s*(\d+)\s*才?\s*(?:允许)?\s*(做多|做空|开多|开空)/giu

    for (const match of text.matchAll(pattern)) {
      const direction = match[1]
      const indicatorRaw = match[2].toLowerCase() as 'ema' | 'sma' | 'ma'
      const period = Number(match[3])
      const action = match[4]

      const isLongAction = action === '做多' || action === '开多'
      const isShortAction = action === '做空' || action === '开空'
      const isAbove = direction === '高于'
      const isBelow = direction === '低于'

      if (isAbove && isLongAction) {
        frames.push({
          kind: 'regime_gate',
          sideScope: 'long',
          indicator: indicatorRaw,
          period,
          operator: 'GT',
          evidenceText: match[0].trim(),
        })
      }
      else if (isBelow && isShortAction) {
        frames.push({
          kind: 'regime_gate',
          sideScope: 'short',
          indicator: indicatorRaw,
          period,
          operator: 'LT',
          evidenceText: match[0].trim(),
        })
      }
    }

    return frames
  }

  private parsePortfolioDrawdown(text: string): PortfolioDrawdownFrameDraft[] {
    const frames: PortfolioDrawdownFrameDraft[] = []

    const enforcePattern = /(?:账户)?\s*回撤\s*(?:超过|大于|过)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:停止|不要|阻止|禁止)\s*(?:开)?\s*(?:新)?\s*仓/giu
    for (const match of text.matchAll(enforcePattern)) {
      const thresholdPct = Number(match[1])
      if (thresholdPct <= 0 || thresholdPct > 100) continue
      frames.push({
        kind: 'portfolio_drawdown',
        thresholdPct,
        mode: 'enforce',
        evidenceText: match[0].trim(),
      })
    }

    const observePattern = /(?:账户)?\s*回撤\s*(?:超过|大于|过)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:仅|只)?\s*(?:记录|观察|observe)/giu
    for (const match of text.matchAll(observePattern)) {
      const thresholdPct = Number(match[1])
      if (thresholdPct <= 0 || thresholdPct > 100) continue
      frames.push({
        kind: 'portfolio_drawdown',
        thresholdPct,
        mode: 'observe',
        evidenceText: match[0].trim(),
      })
    }

    return frames
  }

  /**
   * Phase 5 S8 (#1119): 标的/子策略敞口上限 utterance parser
   *
   * 双门槛：
   *   1) 触发短语：(单)?(标的|子策略|sub[\s-]?strategy)(仓位|敞口|exposure|notional)
   *   2) 数值：(\d+(?:\.\d+)?)\s*%
   *
   * scope 判定：子策略|sub-strategy → substrategy；其他 → symbol
   * effect 判定：暂停|pause → pause_substrategy；缩|reduce|降到|降至|缩到 → reduce_exposure；其他 → block_new_entries
   * mode 判定：仅记录|observe|观察 → observe；其他 → enforce
   */
  private parsePortfolioExposureCap(
    text: string,
  ): Array<PortfolioSymbolExposureCapFrameDraft | PortfolioSubStrategyExposureCapFrameDraft> {
    const frames: Array<PortfolioSymbolExposureCapFrameDraft | PortfolioSubStrategyExposureCapFrameDraft> = []

    const triggerPattern =
      /(?:单\s*)?(?:(子策略|sub[\s-]?strategy)|(标的|symbol))(?:\s*(?:仓位|敞口|exposure|notional))/giu
    const valuePattern = /(\d+(?:\.\d+)?)\s*%/u

    for (const triggerMatch of text.matchAll(triggerPattern)) {
      const isSubStrategy = triggerMatch[1] !== undefined

      // Find value in nearby context (up to 80 chars after trigger)
      const afterTrigger = text.slice(triggerMatch.index)
      const valueMatch = valuePattern.exec(afterTrigger)
      if (!valueMatch) continue

      const notionalCapPct = Number(valueMatch[1])
      if (notionalCapPct <= 0 || notionalCapPct > 100) continue

      // Determine mode
      const mode: 'observe' | 'enforce' = /仅记录|observe|观察/iu.test(afterTrigger) ? 'observe' : 'enforce'

      const evidenceText = triggerMatch[0].trim()

      if (isSubStrategy) {
        // effect: pause_substrategy | block_new_entries
        const effect: 'pause_substrategy' | 'block_new_entries' = /暂停|pause/iu.test(afterTrigger)
          ? 'pause_substrategy'
          : 'block_new_entries'
        // Avoid duplicates for same notionalCapPct + mode + effect
        const isDup = frames.some(
          (f) =>
            f.kind === 'portfolio_substrategy_exposure_cap'
            && (f as PortfolioSubStrategyExposureCapFrameDraft).notionalCapPct === notionalCapPct
            && (f as PortfolioSubStrategyExposureCapFrameDraft).mode === mode
            && (f as PortfolioSubStrategyExposureCapFrameDraft).effect === effect,
        )
        if (!isDup) {
          frames.push({ kind: 'portfolio_substrategy_exposure_cap', notionalCapPct, mode, effect, evidenceText })
        }
      } else {
        // effect: reduce_exposure | block_new_entries
        const effect: 'reduce_exposure' | 'block_new_entries' = /缩|reduce|降到|降至|缩到/iu.test(afterTrigger)
          ? 'reduce_exposure'
          : 'block_new_entries'
        const isDup = frames.some(
          (f) =>
            f.kind === 'portfolio_symbol_exposure_cap'
            && (f as PortfolioSymbolExposureCapFrameDraft).notionalCapPct === notionalCapPct
            && (f as PortfolioSymbolExposureCapFrameDraft).mode === mode
            && (f as PortfolioSymbolExposureCapFrameDraft).effect === effect,
        )
        if (!isDup) {
          frames.push({ kind: 'portfolio_symbol_exposure_cap', notionalCapPct, mode, effect, evidenceText })
        }
      }
    }

    return frames
  }

  private parseFixedGridGated(text: string): FixedGridGatedFrameDraft[] {
    const onDeactivate = this.detectOnDeactivate(text)
    if (!onDeactivate) return []

    if (!this.hasGateReference(text)) return []

    const sizing = this.detectGridSizing(text)

    // Pattern 1: range form e.g. "BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长"
    const rangeMatch = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*区间[^0-9]*?(\d+)\s*档[^0-9]*?(\d+(?:\.\d+)?)\s*%\s*步长/u.exec(text)
    if (rangeMatch) {
      const lowerBound = Number(rangeMatch[1])
      const upperBound = Number(rangeMatch[2])
      const levelCount = Number(rangeMatch[3])
      const stepPct = Number(rangeMatch[4])
      if (lowerBound > 0 && upperBound > lowerBound && levelCount > 0 && stepPct > 0) {
        return [
          {
            kind: 'fixed_grid_gated',
            anchorPrice: (lowerBound + upperBound) / 2,
            levelCount,
            stepPct,
            lowerBound,
            upperBound,
            activeWhenRef: 'orchestration-gate-regime-1',
            onDeactivate,
            sizing,
            evidenceText: rangeMatch[0].trim(),
          },
        ]
      }
    }

    // Pattern 2: anchor form e.g. "锚定 50000 挂 10 档网格 5% 步长"
    const anchorMatch = /锚定\s*(?:价格\s*)?(\d+(?:\.\d+)?)[^0-9]*?(\d+)\s*档[^0-9]*?(\d+(?:\.\d+)?)\s*%\s*步长/u.exec(text)
    if (anchorMatch) {
      const anchorPrice = Number(anchorMatch[1])
      const levelCount = Number(anchorMatch[2])
      const stepPct = Number(anchorMatch[3])
      if (anchorPrice > 0 && levelCount > 0 && stepPct > 0) {
        return [
          {
            kind: 'fixed_grid_gated',
            anchorPrice,
            levelCount,
            stepPct,
            activeWhenRef: 'orchestration-gate-regime-1',
            onDeactivate,
            sizing,
            evidenceText: anchorMatch[0].trim(),
          },
        ]
      }
    }

    return []
  }

  private detectOnDeactivate(text: string): SemanticFixedGridGatedFrame['onDeactivate'] | null {
    if (/(?:停用|失活|不再启用|关闭)\s*时?\s*撤单/u.test(text)) return 'cancel'
    if (/(?:停用|失活|不再启用|关闭)\s*时?\s*平仓/u.test(text)) return 'close'
    if (/(?:停用|失活|不再启用|关闭)\s*时?\s*保留/u.test(text)) return 'keep'
    return null
  }

  private hasGateReference(text: string): boolean {
    return /(?:趋势|行情|上涨|下跌|震荡|启用|禁用|失活|gate|regime)/iu.test(text)
  }

  /**
   * 解析 dynamic_grid 帧（Phase 5 S5 #984）。
   *
   * 必需字段（任一缺失则不抽帧）：
   *   - anchorLookbackBars（最近 N 根 K 线）
   *   - anchorSide（高点/低点/中点 ↔ high/low/mid）
   *   - levelCount（X 档）
   *   - dynamicGridStep（每档 X% / 每档 X USDT / 每档 X 张 / X% 步长）
   *   - activeWhenRef（趋势/鲸鱼等启用提示存在 → orchestration-gate-regime-1）
   *   - onDeactivate（停用时 撤单/保留/平仓）
   * 可选字段：anchorDriftPct（drift X% 时重建）/ rebuildMinIntervalSec（至少间隔 X 秒）
   *
   * 必须先识别"动态网格 / 漂移网格 / 跟随"等显式 dynamic 标记，避免误抢
   * fixed_grid_gated 的"区间网格"语义。
   */
  private parseDynamicGrid(text: string): DynamicGridFrameDraft[] {
    if (!this.hasDynamicGridMarker(text)) return []

    const anchorMatch = /(?:最近|近|跟随)\s*(\d+)\s*根\s*k\s*线/iu.exec(text)
    if (!anchorMatch) return []
    const anchorLookbackBars = Number(anchorMatch[1])
    if (!Number.isInteger(anchorLookbackBars) || anchorLookbackBars <= 0) return []

    const anchorSide = this.detectAnchorSide(text)
    if (!anchorSide) return []

    const levelCountMatch = /(\d+)\s*档/u.exec(text)
    if (!levelCountMatch) return []
    const levelCount = Number(levelCountMatch[1])
    if (!Number.isInteger(levelCount) || levelCount <= 0) return []

    const step = this.detectDynamicGridStep(text)
    if (!step) return []

    const onDeactivate = this.detectOnDeactivate(text)
    if (!onDeactivate) return []

    if (!this.hasGateReference(text)) return []

    const sizing = this.detectGridSizing(text)
    const anchorDriftPct = this.detectAnchorDriftPct(text)
    const rebuildMinIntervalSec = this.detectRebuildMinIntervalSec(text)

    return [
      {
        kind: 'dynamic_grid',
        anchorLookbackBars,
        anchorSide,
        levelCount,
        step,
        anchorDriftPct,
        rebuildMinIntervalSec,
        activeWhenRef: 'orchestration-gate-regime-1',
        onDeactivate,
        sizing,
        evidenceText: anchorMatch[0],
      },
    ]
  }

  private hasDynamicGridMarker(text: string): boolean {
    return /(动态网格|漂移网格|跟随\s*\d+\s*根\s*k\s*线|dynamic\s*grid)/iu.test(text)
  }

  private detectAnchorSide(text: string): SemanticDynamicGridFrame['anchorSide'] | null {
    if (/中点|mid/iu.test(text)) return 'mid'
    if (/高点|high/iu.test(text)) return 'high'
    if (/低点|low/iu.test(text)) return 'low'
    return null
  }

  private detectDynamicGridStep(text: string): SemanticDynamicGridFrame['step'] | null {
    // 优先级：每档 X% > X% 步长 > 档 X%
    const pctMatch = /每档\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*步长|档[^0-9]*?(\d+(?:\.\d+)?)\s*%/u.exec(text)
    if (pctMatch) {
      const value = Number(pctMatch[1] ?? pctMatch[2] ?? pctMatch[3])
      if (Number.isFinite(value) && value > 0) return { mode: 'pct', value }
    }
    const absMatch = /每档\s*(\d+(?:\.\d+)?)\s*(?:usdt|usd|U|价位)/iu.exec(text)
    if (absMatch) {
      const value = Number(absMatch[1])
      if (Number.isFinite(value) && value > 0) return { mode: 'absolute', value }
    }
    return null
  }

  private detectAnchorDriftPct(text: string): number {
    const m = /drift\s*(\d+(?:\.\d+)?)\s*%|漂移\s*(\d+(?:\.\d+)?)\s*%/iu.exec(text)
    if (m) {
      const value = Number(m[1] ?? m[2])
      if (Number.isFinite(value) && value > 0) return value
    }
    return 1 // 默认 1% drift
  }

  private detectRebuildMinIntervalSec(text: string): number {
    const m = /(?:至少)?\s*间隔\s*(\d+)\s*秒|min\s*interval\s*(\d+)/iu.exec(text)
    if (m) {
      const value = Number(m[1] ?? m[2])
      if (Number.isInteger(value) && value >= 60) return value
    }
    return 60 // 默认硬下限 60 秒
  }

  private detectGridSizing(text: string): SemanticFixedGridGatedFrame['sizing'] {
    const quoteMatch = /每档\s*(\d+(?:\.\d+)?)\s*usdt/iu.exec(text)
    if (quoteMatch) return { mode: 'fixed_quote', value: Number(quoteMatch[1]) }
    const baseMatch = /每档\s*(\d+(?:\.\d+)?)\s*张/u.exec(text)
    if (baseMatch) return { mode: 'fixed_base', value: Number(baseMatch[1]) }
    const pctMatch = /每档\s*(\d+(?:\.\d+)?)\s*%/u.exec(text)
    if (pctMatch) return { mode: 'fixed_pct', value: Number(pctMatch[1]) }
    return { mode: 'fixed_pct', value: 5 }
  }

  /**
   * Phase 5 S6 (#984): adaptive_volatility_grid 解析。
   *
   * 触发：包含 "ATR / atr / 波动率" 锚词；解析时不与 fixed_grid_gated 冲突
   * （fixed_grid_gated 要求 "区间挂...档" 或 "锚定..."，与 adaptive 不重叠）。
   *
   * 歧义规则（critic round 1 M5 + round 2 Q7）：
   *   1) `K 倍步长` / `K 倍 step` → atrMultiplier=K（优先匹配）
   *   2) `M 倍区间` / `M 倍 range` → rangeMultiplier=M（优先匹配）
   *   3) 无锚词时按出现顺序：第一个 `X 倍` → atrMultiplier，第二个 → rangeMultiplier
   *   4) ATR 周期：`ATR(N)` / `atr N` / `波动率 N` / `atr-N` 四种归一化为 atrPeriod=N
   *   5) 钳制范围：`不少于 X% 不超过 Y%` / `钳制 X%-Y%` / `每档 X%-Y%`
   */
  private parseAdaptiveVolatilityGrid(text: string): AdaptiveVolatilityGridFrameDraft[] {
    if (!/(ATR|atr|波动率)/u.test(text)) return []
    if (!/自适应/u.test(text) && !/自动?调整/u.test(text)) return []

    const onDeactivate = this.detectOnDeactivate(text) ?? 'cancel'
    if (!this.hasGateReference(text) && !/启用|趋势|上涨|下跌|震荡|鲸鱼|做多|做空/iu.test(text)) {
      return []
    }

    const atrPeriod = this.detectAtrPeriod(text)
    if (atrPeriod === null) return []

    const { atrMultiplier, rangeMultiplier } = this.detectAtrMultipliers(text)
    if (atrMultiplier === null || rangeMultiplier === null) return []

    const levelCount = this.detectAdaptiveLevelCount(text)
    if (levelCount === null) return []

    const stepRange = this.detectAdaptiveStepRange(text)
    if (!stepRange) return []

    const sizing = this.detectGridSizing(text)
    const atrDriftPct = this.detectAtrDriftPct(text)
    const rebuildCooldownSec = this.detectRebuildCooldownSec(text)

    const frame: AdaptiveVolatilityGridFrameDraft = {
      kind: 'adaptive_volatility_grid',
      atrPeriod,
      atrMultiplier,
      rangeMultiplier,
      minStepPct: stepRange.minPct,
      maxStepPct: stepRange.maxPct,
      levelCount,
      activeWhenRef: 'orchestration-gate-regime-1',
      onDeactivate,
      sizing,
      evidenceText: text.slice(0, 120),
    }
    if (atrDriftPct !== null) frame.atrDriftPct = atrDriftPct
    if (rebuildCooldownSec !== null) frame.rebuildCooldownSec = rebuildCooldownSec

    return [frame]
  }

  private detectAtrPeriod(text: string): number | null {
    const parenMatch = /ATR\s*[(（]\s*(\d+)\s*[)）]/iu.exec(text)
    if (parenMatch) return Number(parenMatch[1])
    const dashMatch = /atr\s*-\s*(\d+)/iu.exec(text)
    if (dashMatch) return Number(dashMatch[1])
    const spaceMatch = /atr\s+(\d+)/iu.exec(text)
    if (spaceMatch) return Number(spaceMatch[1])
    const cnMatch = /波动率\s*(\d+)/u.exec(text)
    if (cnMatch) return Number(cnMatch[1])
    return null
  }

  private detectAtrMultipliers(text: string): {
    atrMultiplier: number | null
    rangeMultiplier: number | null
  } {
    let atrMultiplier: number | null = null
    let rangeMultiplier: number | null = null

    const stepAnchor = /(\d+(?:\.\d+)?)\s*倍\s*(?:步长|step)/iu.exec(text)
    if (stepAnchor) atrMultiplier = Number(stepAnchor[1])
    const rangeAnchor = /(\d+(?:\.\d+)?)\s*倍\s*(?:区间|range)/iu.exec(text)
    if (rangeAnchor) rangeMultiplier = Number(rangeAnchor[1])

    if (atrMultiplier === null || rangeMultiplier === null) {
      const fallback = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*倍/giu))
        .map(m => Number(m[1]))
        .filter(n => Number.isFinite(n) && n > 0)
      if (atrMultiplier === null && fallback[0] !== undefined) atrMultiplier = fallback[0]
      if (rangeMultiplier === null && fallback[1] !== undefined) rangeMultiplier = fallback[1]
    }

    return { atrMultiplier, rangeMultiplier }
  }

  private detectAdaptiveLevelCount(text: string): number | null {
    const m = /(\d+)\s*档/u.exec(text)
    if (!m) return null
    const value = Number(m[1])
    return Number.isInteger(value) && value >= 2 ? value : null
  }

  private detectAdaptiveStepRange(text: string): { minPct: number; maxPct: number } | null {
    const explicit = /(?:钳制|每档)\s*(\d+(?:\.\d+)?)\s*%\s*-\s*(\d+(?:\.\d+)?)\s*%/u.exec(text)
    if (explicit) {
      const minPct = Number(explicit[1])
      const maxPct = Number(explicit[2])
      if (minPct > 0 && maxPct >= minPct) return { minPct, maxPct }
    }
    const verbose = /不少于\s*(\d+(?:\.\d+)?)\s*%[^0-9]*?不超过\s*(\d+(?:\.\d+)?)\s*%/u.exec(text)
    if (verbose) {
      const minPct = Number(verbose[1])
      const maxPct = Number(verbose[2])
      if (minPct > 0 && maxPct >= minPct) return { minPct, maxPct }
    }
    const dashRange = /每档\s*(\d+(?:\.\d+)?)\s*%\s*-\s*(\d+(?:\.\d+)?)\s*%/u.exec(text)
    if (dashRange) {
      const minPct = Number(dashRange[1])
      const maxPct = Number(dashRange[2])
      if (minPct > 0 && maxPct >= minPct) return { minPct, maxPct }
    }
    return null
  }

  private detectAtrDriftPct(text: string): number | null {
    const m = /(?:atr|波动率)?\s*漂移\s*(\d+(?:\.\d+)?)\s*%/iu.exec(text)
    if (!m) return null
    const value = Number(m[1])
    return Number.isFinite(value) && value > 0 && value <= 100 ? value : null
  }

  private detectRebuildCooldownSec(text: string): number | null {
    const m = /冷却\s*(\d+)\s*秒/u.exec(text)
    if (!m) return null
    const value = Number(m[1])
    return Number.isInteger(value) && value > 0 ? value : null
  }

  /**
   * Phase 5 S12 (#1118): event_listener 解析。
   *
   * 双门槛触发（critic-anticipated B2 防误触）：
   *   1) 锚词集合：事件监听 / webhook 监听 / webhook listener / 订阅外部事件 /
   *      监听外部信号 / event listener / listen for / 订阅 (tradingview|discord|telegram|webhook) 事件
   *   2) 信号语义：信号 / event / webhook / 触发
   * 缺一不命中 → 不抽 frame（避免与 fixed_grid_gated / dynamic_grid / adaptive_volatility_grid 锚词重叠）。
   *
   * 字段抽取（缺失保 open slot — 由 readiness fail-closed）：
   *   - eventSchemaRef：固定 'webhook_event'
   *   - sourceRef     ：默认 'orchestration-scope-data-source-1'（由 normalizer 透传到 cross-node ref）
   *   - permissionScope：从锚词上下文匹配 `(tradingview|discord|telegram|webhook):.*`，否则空（slot）
   *   - idempotencyKey.fieldPath：默认 'signalId'；显式 `按 (字段名)` 改写（仅 0-1 层 `.`）
   *   - dedupWindowMs ：正则 `(\d+)\s*(秒|s|ms)` → ms（默认 5000）
   *   - expirationTtlMs：正则 `过期\s*(\d+)` → ms（默认 60000）
   *   - expirationPolicy：`(丢弃|drop)→'drop'` / `(上报|escalate)→'escalate'`（默认 'drop'）
   *   - onDeactivate  ：'cancel' / 'keep'（NL gateway 不映射 'close'；'close' 默认走 'cancel'）
   *   - rebuildPolicy ：默认 'static'；显式 `schema 版本变更|schema version bump` → 'on_schema_version_bump'
   */
  private parseEventListener(text: string): EventListenerFrameDraft[] {
    const anchorRe = /(事件监听|webhook\s*监听|webhook\s*listener|订阅外部事件|监听外部信号|event\s*listener|listen\s+for|订阅\s*(?:tradingview|discord|telegram|webhook)\s*事件)/iu
    const semanticRe = /(信号|event|webhook|触发)/iu
    if (!anchorRe.test(text)) return []
    if (!semanticRe.test(text)) return []

    const provider = this.detectEventProvider(text)
    const permissionScope = this.detectPermissionScope(text, provider)
    const fieldPath = this.detectIdempotencyFieldPath(text)
    const dedupWindowMs = this.detectDedupWindowMs(text)
    const expirationTtlMs = this.detectExpirationTtlMs(text)
    const expirationPolicy = this.detectExpirationPolicy(text)
    const explicitDeactivate = this.detectOnDeactivate(text)
    const onDeactivate: SemanticEventListenerFrame['onDeactivate'] =
      explicitDeactivate === 'keep' ? 'keep' : 'cancel' // 'close' 不映射 → 默认 cancel
    const rebuildPolicy: SemanticEventListenerFrame['rebuildPolicy'] =
      /schema\s*(?:版本变更|version\s*bump)/iu.test(text) ? 'on_schema_version_bump' : 'static'

    const frame: EventListenerFrameDraft = {
      kind: 'event_listener',
      eventSchemaRef: 'webhook_event',
      sourceRef: 'orchestration-scope-data-source-1',
      permissionScope,
      idempotencyKey: { fieldPath },
      dedupWindowMs,
      expirationTtlMs,
      expirationPolicy,
      activeWhenRef: 'orchestration-gate-regime-1',
      onDeactivate,
      rebuildPolicy,
      evidenceText: text.slice(0, 120),
    }
    return [frame]
  }

  private detectEventProvider(text: string): string {
    if (/tradingview/iu.test(text)) return 'tradingview'
    if (/discord/iu.test(text)) return 'discord'
    if (/telegram/iu.test(text)) return 'telegram'
    if (/webhook/iu.test(text)) return 'webhook'
    return ''
  }

  private detectPermissionScope(text: string, provider: string): string {
    const scoped = /(tradingview|discord|telegram|webhook)\s*:\s*([a-z0-9_]+)/iu.exec(text)
    if (scoped) return `${scoped[1].toLowerCase()}:${scoped[2].toLowerCase()}`
    if (provider !== '') return `${provider}:default`
    return ''
  }

  private detectIdempotencyFieldPath(text: string): string {
    const m = /按\s*(?:字段|key)?\s*([a-zA-Z][a-zA-Z0-9_]{0,63}(?:\.[a-zA-Z][a-zA-Z0-9_]{0,63})?)/u.exec(text)
    if (m) return m[1]
    return 'signalId'
  }

  private detectDedupWindowMs(text: string): number {
    const m = /(?:去重|dedup)\s*(\d+(?:\.\d+)?)\s*(秒|s|ms|毫秒)/iu.exec(text)
    if (m) {
      const value = Number(m[1])
      const unit = m[2].toLowerCase()
      if (unit === 'ms' || unit === '毫秒') return Math.round(value)
      return Math.round(value * 1000)
    }
    return 5000
  }

  private detectExpirationTtlMs(text: string): number {
    const m = /过期\s*(\d+(?:\.\d+)?)\s*(秒|s|ms|毫秒)?/u.exec(text)
    if (m) {
      const value = Number(m[1])
      const unit = (m[2] ?? '秒').toLowerCase()
      if (unit === 'ms' || unit === '毫秒') return Math.round(value)
      return Math.round(value * 1000)
    }
    return 60000
  }

  private detectExpirationPolicy(text: string): SemanticEventListenerFrame['expirationPolicy'] {
    if (/(?:上报|escalate|告警)/iu.test(text)) return 'escalate'
    return 'drop'
  }
}
