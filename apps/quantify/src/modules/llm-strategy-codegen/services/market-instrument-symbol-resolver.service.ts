import { Injectable } from '@nestjs/common'

import type { MarketInstrumentQuote, MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import type { SemanticAtomContract, SemanticCapabilityShape } from '../types/semantic-state'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

const SUPPORTED_QUOTES: readonly MarketInstrumentQuote[] = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD']
const EXPLICIT_SYMBOL_PATTERN = /^([A-Z0-9]{2,20})(?:([-/\s])?(FDUSD|USDT|USDC|BUSD|TUSD|USD))(?:(-SWAP)|:(PERP|SPOT))?$/iu

const INFERRED_BASE_PATTERN = /^[A-Z][A-Z0-9]{1,19}$/u
const BLOCKED_INFERRED_BASE_PATTERN = /^(?:MA|EMA|SMA|MACD|RSI|ATR|KDJ|BOLL|BOLLINGER)\d*$/u
const BLOCKED_INFERRED_BASES = new Set([
  ...SUPPORTED_QUOTES,
  'OKX',
  'BINANCE',
  'HYPERLIQUID',
  'SPOT',
  'PERP',
  'SWAP',
  'CONTRACT',
  'MA',
  'EMA',
  'SMA',
  'MACD',
  'RSI',
  'ATR',
  'KDJ',
  'BOLL',
  'BOLLINGER',
])

const BASE_SYMBOL_ALIASES: Readonly<Record<string, string>> = {
  ETH: 'ETH',
  BTC: 'BTC',
  以太坊: 'ETH',
  比特币: 'BTC',
}

@Injectable()
export class MarketInstrumentSymbolResolverService {
  resolve(text: string | null | undefined): MarketInstrumentSymbolResolution | null {
    if (typeof text !== 'string') {
      return null
    }

    const evidenceText = text.trim()
    if (!evidenceText) {
      return null
    }

    const explicit = this.resolveExplicit(evidenceText)
    if (explicit) {
      return explicit
    }

    return this.resolveInferred(evidenceText)
  }

  buildContextContract(resolution: MarketInstrumentSymbolResolution): SemanticAtomContract {
    return {
      id: `context-symbol-${resolution.value}`,
      kind: 'context',
      capabilities: [{
        domain: 'market',
        verb: 'identify',
        object: 'instrument',
        shape: this.buildContextShape(resolution),
      }],
      requires: [],
      params: {
        symbol: resolution.value,
        base: resolution.base,
        quote: resolution.quote,
        source: resolution.source,
        quoteSource: resolution.quoteSource,
      },
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }
  }

  private resolveExplicit(evidenceText: string): MarketInstrumentSymbolResolution | null {
    const explicitInput = this.toExplicitSymbolInput(evidenceText)
    if (!explicitInput) {
      return null
    }

    const value = canonicalizeStrategySymbolInput(explicitInput)

    if (!value) {
      return null
    }

    const pair = this.splitSymbolPair(value)
    if (!pair) {
      return null
    }

    const marketTypeHint = this.resolveMarketTypeHint(evidenceText)

    return {
      value,
      source: 'user_explicit',
      evidenceText,
      base: pair.base,
      quote: pair.quote,
      quoteSource: 'explicit',
      ...(marketTypeHint ? { venueSymbolHint: explicitInput, marketTypeHint } : {}),
    }
  }

  private resolveInferred(evidenceText: string): MarketInstrumentSymbolResolution | null {
    const inferredBase = this.resolveBaseAlias(evidenceText)
    if (!inferredBase) {
      return null
    }

    return {
      value: `${inferredBase.base}USDT`,
      source: 'inferred',
      evidenceText,
      base: inferredBase.base,
      quote: 'USDT',
      quoteSource: 'default_usdt',
      ...(inferredBase.marketTypeHint ? { marketTypeHint: inferredBase.marketTypeHint } : {}),
    }
  }

  private splitSymbolPair(value: string): { base: string; quote: MarketInstrumentQuote } | null {
    for (const quote of SUPPORTED_QUOTES) {
      if (!value.endsWith(quote) || value.length <= quote.length) {
        continue
      }

      return {
        base: value.slice(0, -quote.length),
        quote,
      }
    }

    return null
  }

  private resolveBaseAlias(evidenceText: string): { base: string; marketTypeHint?: 'perp' | 'spot' } | null {
    const normalized = evidenceText.trim().toUpperCase()

    const alias = BASE_SYMBOL_ALIASES[normalized]
    if (alias) {
      return { base: alias }
    }

    if (this.isSupportedInferredBase(normalized)) {
      return { base: normalized }
    }

    const perpetualMatch = /^([A-Z][A-Z0-9]{1,19})\s*(?:永续合约|合约)$/u.exec(normalized)
    if (perpetualMatch) {
      const base = perpetualMatch[1] ?? ''
      const resolvedBase = BASE_SYMBOL_ALIASES[base] ?? (this.isSupportedInferredBase(base) ? base : null)
      return resolvedBase ? { base: resolvedBase, marketTypeHint: 'perp' } : null
    }

    const prefixedMarketTypeMatch = /^(合约|永续合约|永续|PERP|SWAP|CONTRACT|现货|SPOT)\s+([A-Z][A-Z0-9]{1,19})$/u.exec(normalized)
    if (prefixedMarketTypeMatch) {
      const marketTypeHint = this.resolveMarketTypeHintFromToken(prefixedMarketTypeMatch[1])
      const base = prefixedMarketTypeMatch[2] ?? ''
      const resolvedBase = BASE_SYMBOL_ALIASES[base] ?? (this.isSupportedInferredBase(base) ? base : null)
      return resolvedBase && marketTypeHint ? { base: resolvedBase, marketTypeHint } : null
    }

    const chineseMatch = /^(以太坊|比特币)(?:永续合约|合约)?$/u.exec(evidenceText.trim())
    if (chineseMatch) {
      const base = BASE_SYMBOL_ALIASES[chineseMatch[1] ?? '']
      return base
        ? {
            base,
            ...(/(?:永续合约|合约)$/u.test(evidenceText.trim()) ? { marketTypeHint: 'perp' as const } : {}),
          }
        : null
    }

    return null
  }

  private isSupportedInferredBase(value: string): boolean {
    return INFERRED_BASE_PATTERN.test(value)
      && !BLOCKED_INFERRED_BASES.has(value)
      && !BLOCKED_INFERRED_BASE_PATTERN.test(value)
  }

  private resolveMarketTypeHintFromToken(value: string | undefined): 'perp' | 'spot' | null {
    if (!value) {
      return null
    }
    if (value === '现货' || value === 'SPOT') {
      return 'spot'
    }
    if (value === '合约' || value === '永续合约' || value === '永续' || value === 'PERP' || value === 'SWAP' || value === 'CONTRACT') {
      return 'perp'
    }

    return null
  }

  private toExplicitSymbolInput(evidenceText: string): string | null {
    const match = EXPLICIT_SYMBOL_PATTERN.exec(evidenceText)
    if (!match) {
      return null
    }

    const [, base, separator, quote, swapSuffix, marketTypeSuffix] = match
    if (!base || !quote) {
      return null
    }

    const pair = separator?.trim() === '' ? `${base}${quote}` : `${base}${separator ?? ''}${quote}`
    if (swapSuffix) {
      return `${pair}${swapSuffix}`
    }
    if (marketTypeSuffix) {
      return `${pair}:${marketTypeSuffix}`
    }

    return pair
  }

  private resolveMarketTypeHint(evidenceText: string): 'perp' | 'spot' | null {
    const normalized = evidenceText.trim().toUpperCase()
    if (normalized.endsWith('-SWAP') || normalized.endsWith(':PERP')) {
      return 'perp'
    }
    if (normalized.endsWith(':SPOT')) {
      return 'spot'
    }

    return null
  }

  private buildContextShape(resolution: MarketInstrumentSymbolResolution): SemanticCapabilityShape {
    return {
      symbol: resolution.value,
      base: resolution.base,
      quote: resolution.quote,
      source: resolution.source,
      quoteSource: resolution.quoteSource,
      ...(resolution.venueSymbolHint ? { venueSymbolHint: resolution.venueSymbolHint } : {}),
      ...(resolution.marketTypeHint ? { marketTypeHint: resolution.marketTypeHint } : {}),
    }
  }
}
