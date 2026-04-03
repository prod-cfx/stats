import { Injectable } from '@nestjs/common'
import type { CanonicalAction, CanonicalSizingMode } from '../types/canonical-strategy-spec'
import type { StrategySemanticIndicator, StrategySemanticProfile, StrategySemanticRuleKey } from '../types/strategy-semantic-profile'

const ACTION_PATTERN = /action\s*:\s*['"]([A-Z_]+)['"]/g
const PARAM_PATTERN = /ctx\.params(?:Normalized)?\??\.([A-Za-z_]\w*)/g

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

    if (/bollingerBands\s*(?:\?\.)?\s*\(/.test(scriptCode)) {
      const match = scriptCode.match(/bollingerBands\s*(?:\?\.)?\s*\([^,]+,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)/)
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

      if (/(?:\.upper\b|\bupper\b|upperband)/.test(window)) {
        push('bollinger.upper_break')
      }
      if (/(?:\.lower\b|\blower\b|lowerband)/.test(window)) {
        push('bollinger.lower_break')
      }
      if (/(?:\bmiddle\b|中轨|\bmid\b|ma20)/.test(window)) {
        push('bollinger.middle_revert')
      }
    })

    return Array.from(mappings.entries()).map(([key, action]) => ({ key, action }))
  }

  private extractSizing(scriptCode: string): StrategySemanticProfile['sizing'] {
    const match = scriptCode.match(/size\s*:\s*\{\s*mode\s*:\s*['"](RATIO|QUOTE|QTY)['"]\s*,\s*value\s*:\s*(\d+(?:\.\d+)?)\s*}/)
    if (!match?.[1] || !match[2]) {
      return null
    }
    return {
      mode: match[1] as CanonicalSizingMode,
      value: Number(match[2]),
    }
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
}
