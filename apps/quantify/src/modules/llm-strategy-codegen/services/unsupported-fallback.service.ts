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

const CHINESE_NEGATIVE_TERMS = ['不要', '算了', '等支持再说', '不改', '先不', '取消', '不可以', '不确认']
const CHINESE_ACCEPT_TERMS = ['确认', '可以', '好', '就这个', '继续', '先测试这个', '用这个']
const CHINESE_MODIFY_TERMS = ['改成', '换成', '不过', '但是', '但', '仓位', '周期', '标的', '交易所']

const ENGLISH_REJECT_PATTERN = /\b(nope|no)\b|wait\s+for\s+support/
const ENGLISH_ACCEPT_PATTERN = /\b(ok|yes|continue)\b/
const ENGLISH_MODIFY_PATTERN = /\b(change|switch|but|however|position|timeframe|symbol|exchange)\b/

@Injectable()
export class UnsupportedFallbackService {
  constructor(private readonly registry: SemanticAtomRegistryService = new SemanticAtomRegistryService()) {}

  buildPendingFallback(unsupportedAtoms: UnsupportedAtomInput[]): UnsupportedFallbackState {
    const replacement = this.resolveReplacement(unsupportedAtoms[0]?.key)
    const unsupportedAtomCopies = unsupportedAtoms.map(atom => ({ ...atom }))
    const names = [...new Set(unsupportedAtomCopies.map(atom => atom.displayName))].join('、')
    const publicReasons = [...new Set(unsupportedAtomCopies.map(atom => atom.publicReason))]

    return {
      status: 'pending',
      unsupportedAtoms: unsupportedAtomCopies,
      recommendedStrategy: cloneReplacement(replacement),
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

    const hasReject = hasRejectIntent(normalizedMessage)
    const hasAccept = hasAcceptIntent(normalizedMessage)
    if (hasReject && !hasAccept) {
      return { kind: 'reject_fallback' }
    }

    if (hasModifyIntent(normalizedMessage)) {
      return { kind: 'modify_fallback', message }
    }

    if (hasReject) {
      return { kind: 'reject_fallback' }
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

function hasModifyIntent(message: string): boolean {
  return includesAny(message, CHINESE_MODIFY_TERMS) || ENGLISH_MODIFY_PATTERN.test(message)
}

function hasRejectIntent(message: string): boolean {
  return includesAny(message, CHINESE_NEGATIVE_TERMS) || hasEnglishRejectIntent(message)
}

function hasAcceptIntent(message: string): boolean {
  return includesChineseAccept(message) || ENGLISH_ACCEPT_PATTERN.test(message)
}

function includesChineseAccept(message: string): boolean {
  return CHINESE_ACCEPT_TERMS.some((term) => {
    if (!message.includes(term)) {
      return false
    }

    return !message.includes(`不${term}`)
  })
}

function includesAny(message: string, terms: string[]): boolean {
  return terms.some(term => message.includes(term))
}

function cloneReplacement(replacement: SemanticAtomReplacementStrategy): SemanticAtomReplacementStrategy {
  return JSON.parse(JSON.stringify(replacement)) as SemanticAtomReplacementStrategy
}

function hasEnglishRejectIntent(message: string): boolean {
  if (message.includes('no problem')) {
    return false
  }

  return ENGLISH_REJECT_PATTERN.test(message)
}
