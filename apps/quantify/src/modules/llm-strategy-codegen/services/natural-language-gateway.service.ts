import type {
  SemanticActionFrame,
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticContextFrame,
  SemanticIndicatorCompareFrame,
  SemanticNaturalLanguageFrame,
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

type ContextFrameDraft = Omit<SemanticContextFrame, 'id' | 'confidence'>
type IndicatorCompareFrameDraft = Omit<SemanticIndicatorCompareFrame, 'id' | 'confidence'>
type BoundaryTouchFrameDraft = Omit<SemanticBoundaryTouchFrame, 'id' | 'confidence'>
type ActionFrameDraft = Omit<SemanticActionFrame, 'id' | 'confidence'>
type RiskFrameDraft = Omit<SemanticRiskFrame, 'id' | 'confidence'>
type CombinationFrameDraft = Omit<SemanticCombinationFrame, 'id' | 'confidence'>

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
      const emaBlock = this.findEmaBlock(clause)
      if (!emaBlock) continue

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

    return frames
  }

  private findEmaBlock(text: string): { periods: number[], evidenceText: string } | undefined {
    const blockMatch = /((?:\bema\s*\d+\b[\s,，、]*){2,})(?=[^。；;]*[上下]方)/iu.exec(text)
    if (!blockMatch) return undefined

    const periods = Array.from(blockMatch[1].matchAll(/\bema\s*(\d+)\b/giu)).map(match => Number(match[1]))
    if (periods.length === 0) return undefined

    return {
      periods,
      evidenceText: blockMatch[1].trim(),
    }
  }

  private hasEmaGate(
    clause: string,
    emaBlock: { evidenceText: string },
    directionText: '上方' | '下方',
    actionTexts: string[],
  ): boolean {
    const blockIndex = clause.indexOf(emaBlock.evidenceText)
    if (blockIndex < 0) return false

    const localText = this.takeUntilNextIndicator(clause.slice(blockIndex + emaBlock.evidenceText.length))
    return localText.includes(directionText) && actionTexts.some(actionText => localText.includes(actionText))
  }

  private takeUntilNextIndicator(text: string): string {
    return text.split(/\b(?:rsi|macd|kdj|boll)\b|布林带?/iu)[0]
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

    for (const clause of this.toClauses(text)) {
      frames.push(...this.parseBoundaryTouchClause(clause))
    }

    return frames
  }

  private parseBoundaryTouchClause(clause: string): BoundaryTouchFrameDraft[] {
    const frames: BoundaryTouchFrameDraft[] = []
    const lowerMatch = /(boll|布林带?)\s*下轨\s*(开多|做多|买入)/iu.exec(clause)
    const upperMatch = /(boll|布林带?)\s*上轨\s*(开空|做空|卖空)/iu.exec(clause)
    const inheritedUpperMatch = /\s上轨\s*(开空|做空|卖空)/iu.exec(clause)

    if (lowerMatch && this.isAffirmativeMatch(clause, lowerMatch.index)) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'lower',
        sideScope: 'long',
        phase: 'entry',
        evidenceText: lowerMatch[0].trim(),
      })
    }

    if (upperMatch && this.isAffirmativeMatch(clause, upperMatch.index)) {
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

    if (frames.length > 0 && inheritedUpperMatch && this.isAffirmativeMatch(clause, inheritedUpperMatch.index)) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'upper',
        sideScope: 'short',
        phase: 'entry',
        evidenceText: inheritedUpperMatch[0].trim(),
      })
    }

    return frames
  }

  private parseActions(text: string): ActionFrameDraft[] {
    const frames: ActionFrameDraft[] = []

    for (const clause of this.toClauses(text)) {
      const openLongMatch = /(开多|做多|买入)/u.exec(clause)
      if (openLongMatch && this.isAffirmativeMatch(clause, openLongMatch.index)) {
        frames.push({
          kind: 'action',
          actionKey: 'open_long',
          evidenceText: openLongMatch[0],
        })
      }

      const openShortMatch = /(卖出开空|开空|做空|卖空)/u.exec(clause)
      if (openShortMatch && this.isAffirmativeMatch(clause, openShortMatch.index)) {
        frames.push({
          kind: 'action',
          actionKey: 'open_short',
          evidenceText: openShortMatch[0],
        })
      }
    }

    return frames
  }

  private isAffirmativeMatch(clause: string, matchIndex: number): boolean {
    const prefix = clause.slice(Math.max(0, matchIndex - 4), matchIndex)
    return !/(不要|禁止|不).{0,3}$/u.test(prefix)
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
}
