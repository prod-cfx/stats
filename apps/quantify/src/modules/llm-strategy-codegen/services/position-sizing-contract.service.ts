import { Injectable } from '@nestjs/common'

import type { SemanticEvidence, SemanticPositionSizingContract } from '../types/semantic-state'

export interface ParsedPositionSizingContract {
  sizing: SemanticPositionSizingContract
  evidence: SemanticEvidence
}

@Injectable()
export class PositionSizingContractService {
  parse(text?: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const normalized = text?.trim().replace(/\s+/gu, ' ') ?? ''
    if (!normalized) return null

    for (const clause of this.splitClauses(normalized)) {
      if (this.looksLikeRiskSizing(clause)) continue

      const parsed = this.parseQuote(clause, messageIndex)
        ?? this.parseBase(clause, messageIndex)
        ?? this.parseRatio(clause, messageIndex)
      if (parsed) return parsed
    }

    return null
  }

  private parseQuote(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    if (!this.hasQuoteSizingContext(text)) return null

    const match = text.match(/(?:固定(?:使用|用|投入)?|单笔(?:使用|用|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|投入)?|投入|用|仓位)?[^\d.]{0,8}(?<![\d.])(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|[uU](?![A-Za-z0-9])|刀|美元)/iu)
    if (!match?.[1] || !match[2]) return null

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return null

    const asset = this.normalizeQuoteAsset(match[2])
    return {
      sizing: { kind: 'quote', value, asset },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private parseBase(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    if (!this.hasBaseSizingContext(text)) return null

    const match = text.match(/(?:固定(?:使用|用|买|投入)?|单笔(?:使用|用|买|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|买|投入)?|买入|买|用)?[^\d.]{0,8}(?<![\d.])(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9]{1,15})\b/u)
    if (!match?.[1] || !match[2]) return null

    const asset = match[2].toUpperCase()
    if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') return null

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return null

    return {
      sizing: { kind: 'base', value, asset },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private parseRatio(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const percentMatch = text.replace(/％/gu, '%').match(/(?:百分之?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)/u)
    if (percentMatch && this.hasRatioSizingContext(text, percentMatch.index ?? 0)) {
      const percent = Number(percentMatch[1] ?? percentMatch[2])
      if (Number.isFinite(percent) && percent > 0 && percent <= 100) {
        return {
          sizing: { kind: 'ratio', value: percent / 100, unit: 'ratio' },
          evidence: { text, messageIndex, source: 'user_explicit' },
        }
      }
    }

    const ratioMatch = text.match(/(?:资金比例|仓位比例|比例)[^\d.]{0,8}(0?\.\d+|1(?:\.0+)?)/u)
      ?? text.match(/(^|[^\d.])(0?\.\d+|1(?:\.0+)?)\s*(?:资金比例|仓位比例|比例)/u)
    if (!ratioMatch) return null

    const value = Number(ratioMatch[2] ?? ratioMatch[1])
    if (!Number.isFinite(value) || value <= 0 || value > 1) return null

    return {
      sizing: { kind: 'ratio', value, unit: 'ratio' },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private normalizeQuoteAsset(input: string): 'USDT' | 'USDC' | 'USD' {
    const upper = input.toUpperCase()
    if (upper === 'USDT' || upper === 'U') return 'USDT'
    if (upper === 'USDC') return 'USDC'
    return 'USD'
  }

  private splitClauses(text: string): string[] {
    return text
      .split(/[，,；;。!！?？]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private hasRatioSizingContext(text: string, index: number): boolean {
    const context = text.slice(Math.max(0, index - 12), index + 20)
    return /(?:仓位|资金|比例|使用|投入|固定|单笔|每次|每笔|每单|用)/u.test(context)
  }

  private hasQuoteSizingContext(text: string): boolean {
    return /(?:仓位|资金|固定|单笔|每次|每笔|每单|使用|投入|用)/u.test(text)
  }

  private hasBaseSizingContext(text: string): boolean {
    return /(?:仓位|资金|固定|单笔|每次|每笔|每单|使用|投入|用|买)/u.test(text)
  }

  private looksLikeRiskSizing(text: string): boolean {
    return /(?:止盈|止损|盈利|亏损|收益|损失|风险|风险额|最大风险|单笔风险|max\s*risk|stop\s*loss|take\s*profit)/iu.test(text)
  }
}
