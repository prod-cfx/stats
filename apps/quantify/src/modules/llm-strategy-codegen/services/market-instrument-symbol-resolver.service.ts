import { Injectable } from '@nestjs/common'

import type { MarketInstrumentQuote, MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import type { SemanticAtomContract, SemanticCapabilityShape } from '../types/semantic-state'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

const SUPPORTED_QUOTES: readonly MarketInstrumentQuote[] = ['USDT', 'USDC', 'USD']
const EXPLICIT_SYMBOL_PATTERN = /^([A-Z0-9]{2,20})(?:([-/\s])?(USDT|USDC|USD))(?:(-SWAP)|:(PERP|SPOT))?$/iu

const BASE_SYMBOL_ALIASES: Readonly<Record<string, 'ETH' | 'BTC'>> = {
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
        verb: 'select',
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
    const base = this.resolveBaseAlias(evidenceText)
    if (!base) {
      return null
    }

    return {
      value: `${base}USDT`,
      source: 'inferred',
      evidenceText,
      base,
      quote: 'USDT',
      quoteSource: 'default_usdt',
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

  private resolveBaseAlias(evidenceText: string): 'ETH' | 'BTC' | null {
    const normalized = evidenceText.trim().toUpperCase()

    if (normalized === 'ETH' || normalized === 'BTC') {
      return normalized
    }

    const perpetualMatch = /^([A-Z]{3})\s*永续合约$/u.exec(normalized)
    if (perpetualMatch) {
      return BASE_SYMBOL_ALIASES[perpetualMatch[1] ?? ''] ?? null
    }

    const chineseMatch = /^(以太坊|比特币)(?:永续合约|合约)?$/u.exec(evidenceText.trim())
    if (chineseMatch) {
      return BASE_SYMBOL_ALIASES[chineseMatch[1] ?? ''] ?? null
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
