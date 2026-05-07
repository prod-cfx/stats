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
      const parsed = this.parseRatio(clause, messageIndex)
        ?? this.parseQuote(clause, messageIndex)
        ?? this.parseBase(clause, messageIndex)
      if (parsed) return parsed
    }

    return null
  }

  private parseQuote(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const quotePattern = /(?<![\d.])(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|[uU](?![A-Za-z0-9])|刀|美元)/giu
    for (const match of text.matchAll(quotePattern)) {
      if (match.index === undefined || !match[1] || !match[2]) continue
      if (!this.hasLocalQuoteSizingContext(text, match.index, match[0].length)) continue

      const value = Number(match[1])
      if (!Number.isFinite(value) || value <= 0) continue

      const asset = this.normalizeQuoteAsset(match[2])
      return {
        sizing: { kind: 'quote', value, asset },
        evidence: { text, messageIndex, source: 'user_explicit' },
      }
    }

    return null
  }

  private parseBase(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    if (!this.hasBaseSizingContext(text)) return null

    const basePattern = /(?:固定(?:使用|用|买|投入)?|单笔(?:使用|用|买|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|买|投入)?|买入|买|用)?[^\d.]{0,8}(?<![\d.])(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9]{1,15})\b/gu
    for (const match of text.matchAll(basePattern)) {
      if (match.index === undefined || !match[1] || !match[2]) continue

      const asset = match[2].toUpperCase()
      if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') continue
      if (this.isTimeframeUnitAsset(asset)) continue
      const valueIndex = match.index + match[0].indexOf(match[1])
      const valueLength = `${match[1]} ${match[2]}`.length
      if (!this.hasLocalBaseSizingContext(text, valueIndex, valueLength)) continue

      const value = Number(match[1])
      if (!Number.isFinite(value) || value <= 0) continue

      return {
        sizing: { kind: 'base', value, asset },
        evidence: { text, messageIndex, source: 'user_explicit' },
      }
    }

    return null
  }

  private isTimeframeUnitAsset(asset: string): boolean {
    return /^(?:MIN|MINS|MINUTE|MINUTES|HOUR|HOURS|DAY|DAYS)$/u.test(asset)
  }

  private parseRatio(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const normalizedPercentText = text.replace(/％/gu, '%')
    const percentPattern = /(?:百分之?\s*(\d+(?:\.\d+)?|[一二三四五六七八九十]+)|(\d+(?:\.\d+)?)\s*%)/gu
    for (const percentMatch of normalizedPercentText.matchAll(percentPattern)) {
      if (!this.hasLocalRatioSizingContext(normalizedPercentText, percentMatch.index, percentMatch[0].length)) continue

      const percent = this.parsePercentNumber(percentMatch[1] ?? percentMatch[2])
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue

      return {
        sizing: { kind: 'ratio', value: percent / 100, unit: 'ratio' },
        evidence: { text, messageIndex, source: 'user_explicit' },
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

  private parsePercentNumber(valueText: string | undefined): number {
    if (!valueText) {
      return Number.NaN
    }

    const numericValue = Number(valueText)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }

    return this.parseChinesePercentNumber(valueText)
  }

  private parseChinesePercentNumber(valueText: string): number {
    const digitMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    }

    if (valueText === '十') {
      return 10
    }

    const tenIndex = valueText.indexOf('十')
    if (tenIndex >= 0) {
      const leadingText = valueText.slice(0, tenIndex)
      const trailingText = valueText.slice(tenIndex + 1)
      const leading = leadingText === '' ? 1 : digitMap[leadingText]
      const trailing = trailingText === '' ? 0 : digitMap[trailingText]
      return leading !== undefined && trailing !== undefined ? leading * 10 + trailing : Number.NaN
    }

    return digitMap[valueText] ?? Number.NaN
  }

  private splitClauses(text: string): string[] {
    return text
      .split(/[，,；;。!！?？]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private hasLocalRatioSizingContext(text: string, index: number, length: number): boolean {
    const prefix = text.slice(Math.max(0, index - 8), index)
    if (/(?:仓位|资金(?!费率)|比例|使用|投入|固定|单笔|每次|每笔|每单|用)\s*[：:]?\s*$/u.test(prefix)) return true

    const suffix = text.slice(index + length, index + length + 8)
    return /^\s*(?:仓位|资金(?!费率)|比例)/u.test(suffix)
  }

  private hasLocalQuoteSizingContext(text: string, index: number, length: number): boolean {
    const prefix = text.slice(Math.max(0, index - 12), index)
    if (/(?:仓位|资金(?!费率)|固定(?:使用|用|投入)?|单笔(?:使用|用|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|投入)?|使用|投入|用)\s*[：:]?\s*$/u.test(prefix)) {
      return true
    }

    const suffix = text.slice(index + length, index + length + 12)
    return /^\s*(?:固定|单笔|每次|每笔|每单|仓位)/u.test(suffix)
  }

  private hasBaseSizingContext(text: string): boolean {
    return /(?:仓位|资金|固定|单笔|每次|每笔|每单|使用|投入|用|买)/u.test(text)
  }

  private hasLocalBaseSizingContext(text: string, index: number, length: number): boolean {
    const prefix = text.slice(Math.max(0, index - 12), index)
    if (/(?:跌到|涨到|达到|价格到|价格|高于|低于|突破|跌破|站上|回落到)\s*$/u.test(prefix)) {
      return false
    }
    if (/(?:仓位|资金(?!费率)|固定(?:使用|用|买|投入)?|单笔(?:使用|用|买|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|买|投入)?|买入|买|用)\s*[：:]?\s*$/u.test(prefix)) {
      return true
    }

    const suffix = text.slice(index + length, index + length + 12)
    return /^\s*(?:仓位|数量|开仓|下单|买入|开多|开空)/u.test(suffix)
  }
}
