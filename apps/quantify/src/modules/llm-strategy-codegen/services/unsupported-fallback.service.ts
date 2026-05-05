import { Injectable } from '@nestjs/common'

import type {
  SemanticAtomReplacementStrategy,
  UnsupportedFallbackIntent,
  UnsupportedFallbackState,
} from '../types/semantic-atom-support'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'

interface UnsupportedAtomInput {
  key: string
  displayName: string
  reasonCode: string
  publicReason: string
}

const DEFAULT_FALLBACK_ATOM_KEY = 'risk.atr_stop'

const REJECT_PATTERN = /不要|算了|等支持再说|不改|先不|取消|\bno\b|wait\s+for\s+support/
const ACCEPT_PATTERN = /确认|可以|好|就这个|继续|先测试这个|用这个|\bok\b|\byes\b|\bcontinue\b/
const MODIFY_PATTERN = /改成|换成|不过|但是|但|仓位|周期|标的|交易所|\bchange\b|\bswitch\b|\bbut\b|\bhowever\b|\bposition\b|\btimeframe\b|\bsymbol\b|\bexchange\b/

@Injectable()
export class UnsupportedFallbackService {
  constructor(private readonly registry: SemanticAtomRegistryService = new SemanticAtomRegistryService()) {}

  buildPendingFallback(unsupportedAtoms: UnsupportedAtomInput[]): UnsupportedFallbackState {
    const replacement = this.resolveReplacement(unsupportedAtoms[0]?.key)
    const unsupportedAtomCopies = unsupportedAtoms.map(atom => ({ ...atom }))
    const names = unsupportedAtomCopies.map(atom => atom.displayName).join('、')
    const publicReasons = [...new Set(unsupportedAtomCopies.map(atom => atom.publicReason))]

    return {
      status: 'pending',
      unsupportedAtoms: unsupportedAtomCopies,
      recommendedStrategy: replacement,
      prompt: [
        `我听懂了，你要的是 ${names}。`,
        ...publicReasons,
        `可以先测试这个相近策略：${replacement.description}`,
        '是否改用这个策略继续？',
      ].join('\n'),
    }
  }

  classifyConfirmation(message: string): UnsupportedFallbackIntent {
    const normalizedMessage = message.trim().toLowerCase()
    if (!normalizedMessage) {
      return { kind: 'unclear' }
    }

    if (REJECT_PATTERN.test(normalizedMessage)) {
      return { kind: 'reject_fallback' }
    }

    const hasAccept = ACCEPT_PATTERN.test(normalizedMessage)
    if (hasAccept && MODIFY_PATTERN.test(normalizedMessage)) {
      return { kind: 'modify_fallback', message }
    }

    if (hasAccept) {
      return { kind: 'accept_fallback' }
    }

    return { kind: 'unclear' }
  }

  private resolveReplacement(atomKey: string | undefined): SemanticAtomReplacementStrategy {
    const atomReplacement = atomKey ? this.readReplacement(atomKey) : undefined
    const fallbackReplacement = this.readReplacement(DEFAULT_FALLBACK_ATOM_KEY)
    const replacement = atomReplacement ?? fallbackReplacement

    if (!replacement) {
      throw new Error('unsupported_fallback_replacement_missing')
    }

    return replacement
  }

  private readReplacement(atomKey: string): SemanticAtomReplacementStrategy | undefined {
    const atom = this.registry.resolve(atomKey)
    if (!hasReplacement(atom)) {
      return undefined
    }

    return atom.replacement
  }
}

function hasReplacement(value: unknown): value is { replacement: SemanticAtomReplacementStrategy } {
  if (!value || typeof value !== 'object' || !('replacement' in value)) {
    return false
  }

  const replacement = value.replacement
  return Boolean(replacement && typeof replacement === 'object' && 'description' in replacement && 'patch' in replacement)
}
