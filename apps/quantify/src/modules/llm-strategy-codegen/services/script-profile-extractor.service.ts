import type { CanonicalAction, CanonicalSizingMode } from '../types/canonical-strategy-spec'
import type {
  StrategySemanticIndicator,
  StrategySemanticProfile,
  StrategySemanticRuleKey,
  StrategySemanticSizing,
} from '../types/strategy-semantic-profile'
import { Injectable } from '@nestjs/common'

const ACTION_PATTERN = /action\s*:\s*['"]([A-Z_]+)['"]/g
const PARAM_PATTERN = /ctx\.params(?:Normalized)?\??\.([A-Za-z_]\w*)/g
const DECISION_SIZE_PATTERN = /size\s*:\s*\{[^}]*mode\s*:\s*['"](RATIO|QUOTE|QTY)['"][^}]*value\s*:\s*([^,\n}]+)/
const LEGACY_RATIO_SIZE_PATTERN = /positionSizeRatio\s*:\s*([^,\n}]+)/
const LEGACY_QUOTE_SIZE_PATTERN = /positionSizeQuote\s*:\s*([^,\n}]+)/

@Injectable()
export class ScriptProfileExtractorService {
  extract(scriptCode: string): StrategySemanticProfile {
    const indicators = this.extractIndicators(scriptCode)
    const actions = this.extractActions(scriptCode)
    const ruleMappings = this.extractRuleMappings(scriptCode)
    const sizing = this.extractSizing(scriptCode)
    const requiredParams = this.extractRequiredParams(scriptCode)

    return {
      indicators,
      actions,
      ruleMappings,
      sizing,
      requiredParams,
      fallbackDetected: this.detectFallback(scriptCode),
    }
  }

  private extractIndicators(scriptCode: string): StrategySemanticIndicator[] {
    const indicators: StrategySemanticIndicator[] = []

    const tryPush = (kind: StrategySemanticIndicator['kind'], params: Record<string, number>) => {
      if (indicators.some(item => item.kind === kind)) return
      indicators.push({ kind, params })
    }

    if (/(?:bollingerBands|bbands)(?:\?\.)?\(/i.test(scriptCode)) {
      const match = scriptCode.match(/(?:bollingerBands|bbands)(?:\?\.)?\([^,]+,\s*(\d+),\s*(\d+(?:\.\d+)?)\s*\)/i)
      const period = Number(match?.[1] ?? 20)
      const stdDev = Number(match?.[2] ?? 2)
      tryPush('bollingerBands', { period, stdDev })
    }
    if (/\.sma\s*\(/.test(scriptCode)) {
      const match = scriptCode.match(/\.sma\s*\([^,]+,\s*(\d+)\s*\)/)
      const period = Number(match?.[1] ?? 20)
      tryPush('sma', { period })
    }
    if (/\.ema\s*\(/.test(scriptCode)) {
      const match = scriptCode.match(/\.ema\s*\([^,]+,\s*(\d+)\s*\)/)
      const period = Number(match?.[1] ?? 20)
      tryPush('ema', { period })
    }
    if (/\.rsi\s*\(/.test(scriptCode)) {
      const match = scriptCode.match(/\.rsi\s*\([^,]+,\s*(\d+)\s*\)/)
      const period = Number(match?.[1] ?? 14)
      tryPush('rsi', { period })
    }
    if (/\.atr\s*\(/.test(scriptCode)) {
      const match = scriptCode.match(/\.atr\s*\([^,]+,\s*(\d+)\s*\)/)
      const period = Number(match?.[1] ?? 14)
      tryPush('atr', { period })
    }
    if (/\.macd\s*\(/.test(scriptCode)) {
      tryPush('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
    }

    if (indicators.length === 0) {
      indicators.push({ kind: 'custom', params: { source: 'script' } })
    }

    return indicators
  }

  private extractActions(scriptCode: string): CanonicalAction[] {
    const actions = new Set<CanonicalAction>()
    for (const match of scriptCode.matchAll(ACTION_PATTERN)) {
      const action = match[1] as CanonicalAction
      if (action === 'OPEN_LONG' || action === 'OPEN_SHORT' || action === 'CLOSE_LONG' || action === 'CLOSE_SHORT' || action === 'ADJUST_POSITION') {
        actions.add(action)
      }
    }
    return Array.from(actions)
  }

  private extractRuleMappings(scriptCode: string): StrategySemanticProfile['ruleMappings'] {
    const mappings = new Map<StrategySemanticRuleKey, CanonicalAction>()
    const actionMatches = Array.from(scriptCode.matchAll(ACTION_PATTERN))

    actionMatches.forEach((match) => {
      const action = match[1] as CanonicalAction
      if (typeof match.index !== 'number') return

      const windowStart = Math.max(0, match.index - 160)
      const window = scriptCode.slice(windowStart, match.index + 40).toLowerCase()
      const push = (key: StrategySemanticRuleKey) => {
        if (!mappings.has(key)) {
          mappings.set(key, action)
        }
      }

      if (/\.upper\b|\bupper\b|upperband/.test(window)) {
        push('bollinger.upper_break')
      }
      if (/\.lower\b|\blower\b|lowerband/.test(window)) {
        push('bollinger.lower_break')
      }
      if (/\bmiddle\b|中轨|\bmid\b|ma20/.test(window)) {
        push('bollinger.middle_revert')
      }
    })

    return Array.from(mappings.entries()).map(([key, action]) => ({ key, action }))
  }

  private extractSizing(scriptCode: string): StrategySemanticProfile['sizing'] {
    const decisionMatch = scriptCode.match(DECISION_SIZE_PATTERN)
    if (decisionMatch?.[1] && decisionMatch[2]) {
      return this.resolveSizingExpression({
        scriptCode,
        mode: decisionMatch[1] as CanonicalSizingMode,
        expression: decisionMatch[2],
      })
    }

    const legacyRatioMatch = scriptCode.match(LEGACY_RATIO_SIZE_PATTERN)
    if (legacyRatioMatch?.[1]) {
      return this.resolveSizingExpression({
        scriptCode,
        mode: 'RATIO',
        expression: legacyRatioMatch[1],
      })
    }

    const legacyQuoteMatch = scriptCode.match(LEGACY_QUOTE_SIZE_PATTERN)
    if (legacyQuoteMatch?.[1]) {
      return this.resolveSizingExpression({
        scriptCode,
        mode: 'QUOTE',
        expression: legacyQuoteMatch[1],
      })
    }

    return null
  }

  private extractRequiredParams(scriptCode: string): string[] {
    const params = new Set<string>()
    for (const match of scriptCode.matchAll(PARAM_PATTERN)) {
      const key = match[1]?.trim()
      if (key) params.add(key)
    }
    return Array.from(params)
  }

  private detectFallback(scriptCode: string): boolean {
    if (/fallback:/i.test(scriptCode)) return true
    const normalized = scriptCode.toLowerCase()
    const guardMarkers = [
      'insufficient bars',
      'insufficient close series',
      'sma unavailable',
    ]
    const signalMarkers = [
      'neutral trend',
      'fast sma above slow sma',
      'fast sma below slow sma',
    ]
    const guardHits = guardMarkers.filter(marker => normalized.includes(marker)).length
    const signalHits = signalMarkers.filter(marker => normalized.includes(marker)).length
    return guardHits >= 2 && signalHits >= 1
  }

  private resolveSizingExpression(input: {
    scriptCode: string
    mode: CanonicalSizingMode
    expression: string
    depth?: number
  }): StrategySemanticSizing {
    const depth = input.depth ?? 0
    const expression = input.expression.trim()

    if (/^\d+(?:\.\d+)?$/.test(expression)) {
      return {
        mode: input.mode,
        value: Number(expression),
        source: 'literal',
      }
    }

    if (this.isNormalizedPositionPctExpression(expression)) {
      return {
        mode: input.mode,
        value: null,
        source: 'positionPct_normalized',
      }
    }

    if (this.isAliasNormalizedPositionPctExpression({
      scriptCode: input.scriptCode,
      expression,
      depth,
      mode: input.mode,
    })) {
      return {
        mode: input.mode,
        value: null,
        source: 'positionPct_normalized',
      }
    }

    if (this.isRawPositionPctExpression(expression)) {
      return {
        mode: input.mode,
        value: null,
        source: 'positionPct_raw',
      }
    }

    const identifier = expression.match(/^[a-z_]\w*$/i)?.[0]
    if (identifier && depth < 3) {
      const assignedExpression = this.findAssignedExpression(input.scriptCode, identifier)
      if (assignedExpression) {
        return this.resolveSizingExpression({
          ...input,
          expression: assignedExpression,
          depth: depth + 1,
        })
      }
    }

    return {
      mode: input.mode,
      value: null,
      source: 'unknown',
    }
  }

  private isAliasNormalizedPositionPctExpression(input: {
    scriptCode: string
    expression: string
    depth: number
    mode: CanonicalSizingMode
  }): boolean {
    const aliases = Array.from(input.expression.matchAll(/\b([a-z_]\w*)\s*\/\s*100\b/gi))
      .map(match => match[1])
      .filter((identifier): identifier is string => typeof identifier === 'string' && identifier.length > 0)

    for (const identifier of aliases) {
      const assignedExpression = this.findAssignedExpression(input.scriptCode, identifier)
      if (!assignedExpression) continue

      if (this.isRawPositionPctExpression(assignedExpression) || this.isNormalizedPositionPctExpression(assignedExpression)) {
        return true
      }

      if (input.depth >= 3) continue
      const resolvedAssigned = this.resolveSizingExpression({
        scriptCode: input.scriptCode,
        mode: input.mode,
        expression: assignedExpression,
        depth: input.depth + 1,
      })
      if (resolvedAssigned.source === 'positionPct_raw' || resolvedAssigned.source === 'positionPct_normalized') {
        return true
      }
    }

    return false
  }

  private isNormalizedPositionPctExpression(expression: string): boolean {
    return /positionPct\s*\/\s*100/.test(expression)
      || /params(?:Normalized)?\??\.positionPct\s*\/\s*100/.test(expression)
  }

  private isRawPositionPctExpression(expression: string): boolean {
    return /params(?:Normalized)?\??\.positionPct/.test(expression)
      || expression === 'positionPct'
  }

  private findAssignedExpression(scriptCode: string, identifier: string): string | null {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const declarationPattern = new RegExp(
      `(?:const|let|var)\\s+${escaped}\\s*=\\s*([\\s\\S]{0,400}?)(?=;|\\n\\s*(?:const|let|var|return|if|for|while)\\b|\\n\\s*\\})`,
    )
    const declarationMatch = declarationPattern.exec(scriptCode)
    if (declarationMatch?.[1]) {
      return declarationMatch[1].trim()
    }

    return null
  }
}
