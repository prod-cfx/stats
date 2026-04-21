import type {
  CodegenGuidePromptConfigSnapshot,
  ConstraintPackInferredConfirmationSnapshot,
  ConstraintPackSnapshot,
} from '../constants/constraint-pack'
import type { CodegenGuideConfigDto } from '../dto/codegen-guide-config.dto'
import type { StrategyLogicSnapshot } from '../types/strategy-logic-snapshot'

import { createDefaultConstraintPack } from '../constants/constraint-pack'

export type GuidePromptConfig = CodegenGuidePromptConfigSnapshot
export type RecommendationStyle = 'ma' | 'drop-rise'
export type ConversationMessage = { role: 'user' | 'assistant', content: string }

export const MAX_PLANNER_HISTORY_LINES = 12

export class CodegenConversationContextHelper {
  readConstraintPack(payload: unknown): ConstraintPackSnapshot {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return createDefaultConstraintPack()
    }

    const raw = payload as Record<string, unknown>
    const guidePrompt = this.mergeGuidePromptConfig(undefined, raw.guidePrompt as CodegenGuideConfigDto | undefined)
    const conversationHistory = this.normalizeStringArray(raw.conversationHistory)
    const inferredConfirmation = this.normalizeInferredConfirmation(raw.inferredConfirmation)

    return {
      ...createDefaultConstraintPack(),
      ...raw,
      guidePrompt,
      conversationHistory,
      inferredConfirmation,
    } as ConstraintPackSnapshot
  }

  withGuidePrompt(
    pack: ConstraintPackSnapshot,
    guidePrompt?: GuidePromptConfig,
    recommendationStyle?: RecommendationStyle,
  ): ConstraintPackSnapshot {
    return {
      ...pack,
      guidePrompt,
      recommendationStyle,
    }
  }

  mergeGuidePromptConfig(
    base?: GuidePromptConfig,
    patch?: CodegenGuideConfigDto,
  ): GuidePromptConfig | undefined {
    const merge = {
      symbolExample: patch?.symbolExample ?? base?.symbolExample,
      timeframeExample: patch?.timeframeExample ?? base?.timeframeExample,
      entryRuleExample: patch?.entryRuleExample ?? base?.entryRuleExample,
      exitRuleExample: patch?.exitRuleExample ?? base?.exitRuleExample,
      riskRuleExample: patch?.riskRuleExample ?? base?.riskRuleExample,
    }

    const normalized = Object.fromEntries(
      Object.entries(merge)
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
        .filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as GuidePromptConfig

    return Object.keys(normalized).length > 0 ? normalized : undefined
  }

  private normalizeInferredConfirmation(value: unknown): ConstraintPackInferredConfirmationSnapshot | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    const raw = value as Record<string, unknown>
    return {
      confirmedKeys: this.normalizeStringArray(raw.confirmedKeys),
      overriddenKeys: this.normalizeStringArray(raw.overriddenKeys),
    }
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  }

  appendConversationHistory(
    current: string[],
    userMessage?: string,
    assistantMessage?: string,
  ): string[] {
    const next = [...current]
    const push = (prefix: 'U' | 'A', value?: string) => {
      const normalized = value?.trim()
      if (!normalized) return
      next.push(`${prefix}: ${normalized}`)
    }
    push('U', userMessage)
    push('A', assistantMessage)
    return next.slice(-MAX_PLANNER_HISTORY_LINES)
  }

  toConversationMessages(history: string[] | undefined): ConversationMessage[] {
    const messages: ConversationMessage[] = []

    for (const entry of history ?? []) {
      const normalized = entry.trim()
      if (!normalized) continue
      if (normalized.startsWith('U:')) {
        const content = normalized.slice(2).trim()
        if (content) {
          messages.push({ role: 'user', content })
        }
        continue
      }
      if (normalized.startsWith('A:')) {
        const content = normalized.slice(2).trim()
        if (content) {
          messages.push({ role: 'assistant', content })
        }
      }
    }

    return messages
  }

  deriveConversationTitle(messages: ConversationMessage[]): string {
    const firstUser = messages.find(message => message.role === 'user' && message.content.trim())
    return firstUser?.content.trim().slice(0, 16) || '新对话'
  }

  inferRecommendationStyleFromContext(
    message: string | undefined,
    checklist: StrategyLogicSnapshot,
    currentStyle?: RecommendationStyle,
  ): RecommendationStyle | undefined {
    const fromLogicSnapshot = this.detectRecommendationStyleFromLogicSnapshot(checklist)
    if (fromLogicSnapshot) {
      return fromLogicSnapshot
    }
    const text = (message ?? '').trim()
    if (text) {
      if (/均线|金叉|死叉|\bma\b|moving average/i.test(text)) {
        return 'ma'
      }
      if (/下跌|上涨|回撤|[跌涨天%]|分钟|小时|\d+\s*[mhd]/i.test(text)) {
        return 'drop-rise'
      }
    }
    return currentStyle
  }

  private detectRecommendationStyleFromLogicSnapshot(checklist: StrategyLogicSnapshot): RecommendationStyle | undefined {
    const rules = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    if (!rules.trim()) return undefined
    if (/金叉|死叉|均线|ma|moving average/i.test(rules)) return 'ma'
    if (/下跌|上涨|回撤|[跌涨%]|\d+\s*[mhd]/i.test(rules)) return 'drop-rise'
    return undefined
  }
}
