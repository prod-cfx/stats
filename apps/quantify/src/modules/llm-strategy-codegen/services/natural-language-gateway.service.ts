import type {
  SemanticActionFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticContextFrame,
  SemanticDynamicGridFrame,
  SemanticFixedGridGatedFrame,
  SemanticIndicatorCompareFrame,
  SemanticNaturalLanguageFrame,
  SemanticPortfolioDrawdownFrame,
  SemanticRegimeGateFrame,
  SemanticRiskFrame,
} from '../types/semantic-natural-language-frame'
import { Injectable } from '@nestjs/common'

type FrameDraft =
  | ContextFrameDraft
  | IndicatorCompareFrameDraft
  | BoundaryTouchFrameDraft
  | ActionFrameDraft
  | RiskFrameDraft
  | CombinationFrameDraft
  | RegimeGateFrameDraft
  | PortfolioDrawdownFrameDraft
  | FixedGridGatedFrameDraft
  | DynamicGridFrameDraft

type ContextFrameDraft = Omit<SemanticContextFrame, 'id' | 'confidence'>
type IndicatorCompareFrameDraft = Omit<SemanticIndicatorCompareFrame, 'id' | 'confidence'>
type BoundaryTouchFrameDraft = Omit<SemanticBoundaryTouchFrame, 'id' | 'confidence'>
type ActionFrameDraft = Omit<SemanticActionFrame, 'id' | 'confidence'>
type RiskFrameDraft = Omit<SemanticRiskFrame, 'id' | 'confidence'>
type CombinationFrameDraft = Omit<SemanticCombinationFrame, 'id' | 'confidence'>
type RegimeGateFrameDraft = Omit<SemanticRegimeGateFrame, 'id' | 'confidence'>
type PortfolioDrawdownFrameDraft = Omit<SemanticPortfolioDrawdownFrame, 'id' | 'confidence'>
type FixedGridGatedFrameDraft = Omit<SemanticFixedGridGatedFrame, 'id' | 'confidence'>
type DynamicGridFrameDraft = Omit<SemanticDynamicGridFrame, 'id' | 'confidence'>

@Injectable()
export class NaturalLanguageGatewayService {
  parse(input?: string): SemanticNaturalLanguageFrame[] {
    const text = this.normalizeInput(input)
    if (!text) return []

    const drafts: FrameDraft[] = [
      ...this.parseContext(text),
      ...this.parseEmaGates(text),
      ...this.parseBoundaryTouches(text),
      ...this.parseActions(text),
      ...this.parseRisk(text),
      ...this.parseRegimeGate(text),
      ...this.parsePortfolioDrawdown(text),
      ...this.parseDynamicGrid(text),
      ...this.parseFixedGridGated(text),
    ]

    return drafts.map((draft, index) => ({
      ...draft,
      id: `natural-language-frame-${index + 1}`,
      confidence: 0.9,
    }))
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
}
