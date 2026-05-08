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
    const emaBlock = this.findEmaBlock(text)
    if (!emaBlock) return []

    const frames: Array<IndicatorCompareFrameDraft | CombinationFrameDraft> = []
    const hasLongGate = /上方/u.test(text) && /(只开多|开多|做多)/u.test(text)
    const hasShortGate = /下方/u.test(text) && /(只开空|开空|做空)/u.test(text)

    if (hasLongGate) {
      frames.push(...this.toEmaCompareFrames(emaBlock.periods, 'GT', 'long', 'ema-gate-long', emaBlock.evidenceText))
      frames.push({
        kind: 'combination',
        groupId: 'ema-gate-long',
        join: 'AND',
        sideScope: 'long',
        evidenceText: emaBlock.evidenceText,
      })
    }

    if (hasShortGate) {
      frames.push(...this.toEmaCompareFrames(emaBlock.periods, 'LT', 'short', 'ema-gate-short', emaBlock.evidenceText))
      frames.push({
        kind: 'combination',
        groupId: 'ema-gate-short',
        join: 'AND',
        sideScope: 'short',
        evidenceText: emaBlock.evidenceText,
      })
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
    const hasBollingerContext = /(boll|布林带?|BOLL)/iu.test(text)

    if (hasBollingerContext && /下轨\s*(?:开多|做多|买入|买)/iu.test(text)) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'lower',
        sideScope: 'long',
        phase: 'entry',
        evidenceText: this.boundaryEvidence(text, 'lower'),
      })
    }

    if (hasBollingerContext && /上轨\s*(?:开空|做空|卖空)/iu.test(text)) {
      frames.push({
        kind: 'boundary_touch',
        indicator: 'bollinger',
        boundaryRole: 'upper',
        sideScope: 'short',
        phase: 'entry',
        evidenceText: this.boundaryEvidence(text, 'upper'),
      })
    }

    return frames
  }

  private boundaryEvidence(text: string, boundaryRole: SemanticBoundaryTouchFrame['boundaryRole']): string {
    const boundary = boundaryRole === 'upper' ? '上轨' : '下轨'
    const match = new RegExp(`(?:boll|布林带?|BOLL)?\\s*${boundary}\\s*(?:开多|做多|买入|买|开空|做空|卖空)`, 'iu').exec(text)

    return match?.[0].trim() ?? boundary
  }

  private parseActions(text: string): ActionFrameDraft[] {
    const frames: ActionFrameDraft[] = []

    if (/(开多|做多|买入|买)/u.test(text)) {
      frames.push({
        kind: 'action',
        actionKey: 'open_long',
        evidenceText: '开多',
      })
    }

    if (/(开空|做空|卖空)/u.test(text)) {
      frames.push({
        kind: 'action',
        actionKey: 'open_short',
        evidenceText: '开空',
      })
    }

    return frames
  }

  private parseRisk(text: string): RiskFrameDraft[] {
    const match = /亏损\s*(?:百分之?|%?\s*)?(\d+(?:\.\d+)?)\s*%?\s*止损/u.exec(text)
    if (!match) return []

    return [
      {
        kind: 'risk',
        riskKey: 'risk.stop_loss_pct',
        valuePct: Number(match[1]),
        evidenceText: match[0],
      },
    ]
  }
}
