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

type UnsupportedFallbackLocale = 'zh' | 'en'

const DEFAULT_FALLBACK_ATOM_KEY = 'risk.atr_stop'
const DEFAULT_REPLACEMENT_EN_DESCRIPTION = 'Go long when MA20 crosses above MA50, close when MA20 crosses below MA50, with 5% stop loss, 10% take profit, and 10% position size per trade.'

// 当用户输入既触发 supported 的具体识别（如 price.candle_pattern / price.chart_pattern /
// liquidity.sweep），又被裸 pattern 兜底分支误捕成 unsupported 的 price.pattern 时，
// 下游 fallback 会读 unsupported 误导用户改用替代策略。
// 该映射声明：当 supported 集中存在 `value`，就过滤掉 unsupported 中 `key` 项。
const UNSUPPORTED_COVERED_BY_SUPPORTED: Record<string, readonly string[]> = {
  'price.pattern': ['price.candle_pattern', 'price.chart_pattern', 'liquidity.sweep'],
}

const CHINESE_NEGATIVE_TERMS = ['不要', '算了', '等支持再说', '不改', '先不', '取消', '不可以', '不确认', '不好']
const CHINESE_ACCEPT_TERMS = ['确认', '可以', '好', '就这个', '继续', '先测试这个', '用这个']
const CHINESE_MODIFY_TERMS = ['改成', '换成', '不过', '但是', '但', '仓位', '周期', '标的', '交易所']

const ENGLISH_REJECT_PATTERN = /\b(nope|no)\b|wait\s+for\s+support/
const ENGLISH_ACCEPT_PATTERN = /\b(ok|yes|continue)\b/
const ENGLISH_MODIFY_PATTERN = /\b(change|switch|but|however|position|timeframe|symbol|exchange)\b/

@Injectable()
export class UnsupportedFallbackService {
  constructor(private readonly registry: SemanticAtomRegistryService = new SemanticAtomRegistryService()) {}

  /**
   * 过滤掉与 supported 触发器形成"同义覆盖"的 unsupported atom。
   * 典型场景：K 线形态既被 supported `price.candle_pattern` 识别，也被裸 pattern 兜底分支
   * 误捕成 unsupported `price.pattern`。两者并存时，下游 fallback 会读 unsupported 误导用户。
   */
  filterUnsupportedAtomsCoveredBySupported(
    unsupportedAtoms: UnsupportedAtomInput[],
    supportedTriggers: ReadonlyArray<{ key: string }>,
  ): UnsupportedAtomInput[] {
    const supportedKeys = new Set(supportedTriggers.map(trigger => trigger.key))
    return unsupportedAtoms.filter((atom) => {
      const coveredBy = UNSUPPORTED_COVERED_BY_SUPPORTED[atom.key]
      if (!coveredBy) {
        return true
      }
      return !coveredBy.some(supportedKey => supportedKeys.has(supportedKey))
    })
  }

  buildPendingFallback(
    unsupportedAtoms: UnsupportedAtomInput[],
    supportedTriggers: ReadonlyArray<{ key: string }> = [],
    locale: UnsupportedFallbackLocale = 'zh',
  ): UnsupportedFallbackState | null {
    const filtered = this.filterUnsupportedAtomsCoveredBySupported(unsupportedAtoms, supportedTriggers)

    if (filtered.length === 0) {
      return null
    }

    const replacement = this.resolveReplacement(filtered[0]?.key)
    const unsupportedAtomCopies = filtered.map(atom => ({ ...atom }))
    // Issue #1495: 禁止把 internal atom key（如 `volume.spike`）漏到 user-facing prompt。
    //   EN locale 也走 displayName；缺失时只能用通用「unsupported feature」兜底，
    //   绝不直接写 atom.key（dotted internal identifier）。
    // Issue #1495 M2: zh locale 也加 displayName 缺失兜底，避免空串/undefined 漏到 prompt
    const names = locale === 'en'
      ? [...new Set(unsupportedAtomCopies.map(atom => atom.displayName?.trim() || 'an unsupported feature'))].join(', ')
      : [...new Set(unsupportedAtomCopies.map(atom => atom.displayName?.trim() || '未支持的功能'))].join('、')
    const publicReasons = locale === 'en'
      ? [...new Set(unsupportedAtomCopies.map(atom => atom.reasonCode))]
        .map(reasonCode => `Reason: ${reasonCode}. This semantic is recognized but is not supported by the current public beta execution layer yet.`)
      : [...new Set(unsupportedAtomCopies.map(atom => atom.publicReason))]
    const localizedReplacement = {
      ...cloneReplacement(replacement),
      description: this.localizeReplacementDescription(replacement, locale),
    }

    return {
      status: 'pending',
      unsupportedAtoms: unsupportedAtomCopies,
      recommendedStrategy: localizedReplacement,
      prompt: locale === 'en'
        ? [
            `I understand you want: ${names}.`,
            ...publicReasons,
            `You can test this similar supported strategy first: ${localizedReplacement.description}`,
            'Switch to this strategy and continue?',
          ].join('\n')
        : [
            `我听懂了，你要的是 ${names}。`,
            ...publicReasons,
            `可以先测试这个相近策略：${localizedReplacement.description}`,
            '是否改用这个策略继续？',
          ].join('\n'),
    }
  }

  private localizeReplacementDescription(
    replacement: SemanticAtomReplacementStrategy,
    locale: UnsupportedFallbackLocale,
  ): string {
    if (locale === 'en' && replacement.strategyKey === 'ma_cross_with_fixed_risk') {
      return DEFAULT_REPLACEMENT_EN_DESCRIPTION
    }
    return replacement.description
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
