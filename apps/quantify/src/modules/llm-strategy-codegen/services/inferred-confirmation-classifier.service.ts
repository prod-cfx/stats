import type { StrategyRuleBasis } from '../types/strategy-logic-snapshot'
import type { AiService } from '@/modules/ai/ai.service'
import type { ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'
import { Injectable } from '@nestjs/common'

const INFERRED_CONFIRMATION_DECISION_KEYS = ['risk.stopLossBasis', 'risk.takeProfitBasis'] as const

export type InferredConfirmationDecisionKey = typeof INFERRED_CONFIRMATION_DECISION_KEYS[number]
type InferredConfirmationIntent = 'override' | 'reject' | 'confirm' | 'unclear'
type InferredConfirmationSource = 'rule' | 'llm'
type InferredConfirmationFallbackIntent = 'confirm' | 'override' | 'unclear'

export interface InferredConfirmationClassifierInput {
  message?: string | null
  assistantPrompt?: string | null
  conversationPhase?: string | null
  providerCode?: string | null
  model?: string | null
  decisionKeys: readonly string[]
  semanticDefaults: InferredConfirmationSemanticDefaults
}

export interface InferredConfirmationSemanticDefaults {
  stopLossBasis?: StrategyRuleBasis['kind'] | null
  takeProfitBasis?: StrategyRuleBasis['kind'] | null
  inferredKeys?: readonly unknown[] | null
}

export interface InferredConfirmationClassification {
  intent: InferredConfirmationIntent
  source: InferredConfirmationSource
  confirmedKeys: string[]
  overriddenKeys: string[]
  overriddenBasisByKey: Partial<Record<string, StrategyRuleBasis['kind']>>
}

interface InferredConfirmationFallbackResponse {
  intent: InferredConfirmationFallbackIntent
  targetKeys?: unknown
  normalizedBasis?: unknown
}

const FALLBACK_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'targetKeys'],
  properties: {
    intent: {
      type: 'string',
      enum: ['confirm', 'override', 'unclear'],
    },
    targetKeys: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...INFERRED_CONFIRMATION_DECISION_KEYS],
      },
    },
    normalizedBasis: {
      type: 'string',
      enum: [
        'prev_close',
        'entry_avg_price',
        'position_pnl',
        'peak_equity',
        'peak_position_pnl',
        'upper_band',
        'lower_band',
        'middle_band',
        'last_high',
        'last_low',
      ],
    },
  },
}

function isInferredConfirmationDecisionKey(value: unknown): value is InferredConfirmationDecisionKey {
  return typeof value === 'string'
    && (INFERRED_CONFIRMATION_DECISION_KEYS as readonly string[]).includes(value)
}

@Injectable()
export class InferredConfirmationClassifierService {
  constructor(private readonly aiService?: Pick<AiService, 'chat'>) {}

  async classifyInferredDecisionReply(
    input: InferredConfirmationClassifierInput,
  ): Promise<InferredConfirmationClassification> {
    const message = input.message?.trim()
    if (!message) {
      return this.buildUnclearResult()
    }

    const activeKeys = new Set(
      input.decisionKeys.filter((key): key is InferredConfirmationDecisionKey => isInferredConfirmationDecisionKey(key),
      ),
    )
    if (activeKeys.size === 0) {
      return this.buildUnclearResult()
    }
    const assistantPrompt = input.assistantPrompt?.trim() ?? ''
    const isConfirmInferredPhase = input.conversationPhase === 'CONFIRM_INFERRED'

    const confirmedKeys = new Set<string>()
    const overriddenKeys = new Set<string>()
    const overriddenBasisByKey: Partial<Record<string, StrategyRuleBasis['kind']>> = {}
    let sawReject = false
    let sawConfirm = false

    for (const clause of this.splitClauses(message)) {
      const clauseTargets = this.resolveClauseTargets(clause, activeKeys)
      const basis = this.normalizeBasisClarificationAnswer(clause)
      const isQuestionClause = this.isQuestionClause(clause)

      if (clauseTargets.length > 0 && basis) {
        for (const key of clauseTargets) {
          overriddenKeys.add(key)
          overriddenBasisByKey[key] = basis
        }
        continue
      }

      if (this.isRejectClause(clause, isQuestionClause, clauseTargets)) {
        sawReject = true
        continue
      }

      if (this.isConfirmClause(clause, clauseTargets, isQuestionClause, message)) {
        sawConfirm = true
        const confirmationTargets = clauseTargets.length > 0
          ? clauseTargets
          : Array.from(activeKeys)
        for (const key of confirmationTargets) {
          confirmedKeys.add(key)
        }
      }
    }

    const finalConfirmedKeys = Array.from(confirmedKeys).filter(key => !overriddenKeys.has(key))
    const finalOverriddenKeys = Array.from(overriddenKeys)

    if (finalOverriddenKeys.length === 0) {
      const defaultOverrideKeys = this.detectDefaultOverrideKeys(message, activeKeys)
      if (defaultOverrideKeys.length > 0) {
        const defaultOverrideKeySet = new Set<string>(defaultOverrideKeys)
        return {
          intent: 'override',
          source: 'rule',
          confirmedKeys: finalConfirmedKeys.filter(key => !defaultOverrideKeySet.has(key)),
          overriddenKeys: defaultOverrideKeys,
          overriddenBasisByKey: {},
        }
      }
    }

    if (finalOverriddenKeys.length > 0) {
      return {
        intent: 'override',
        source: 'rule',
        confirmedKeys: finalConfirmedKeys,
        overriddenKeys: finalOverriddenKeys,
        overriddenBasisByKey,
      }
    }

    if (sawReject) {
      return {
        intent: 'reject',
        source: 'rule',
        confirmedKeys: [],
        overriddenKeys: [],
        overriddenBasisByKey: {},
      }
    }

    if (finalConfirmedKeys.length > 0 || sawConfirm) {
      return {
        intent: 'confirm',
        source: 'rule',
        confirmedKeys: finalConfirmedKeys,
        overriddenKeys: [],
        overriddenBasisByKey: {},
      }
    }

    if (!this.shouldAttemptFallback({
      message,
      assistantPrompt,
      activeKeys,
      isConfirmInferredPhase,
    })) {
      return this.buildUnclearResult()
    }

    const fallback = await this.runFallback({
      message,
      assistantPrompt,
      activeKeys: Array.from(activeKeys),
      pendingKeyDefaults: this.buildPendingKeyDefaults(input.semanticDefaults, activeKeys),
      providerCode: input.providerCode?.trim() || undefined,
      model: input.model?.trim() || undefined,
    })
    if (fallback.intent === 'confirm') {
      if (fallback.targetKeys.length === 0) {
        return this.buildUnclearResult('llm')
      }
      return {
        intent: 'confirm',
        source: 'llm',
        confirmedKeys: fallback.targetKeys,
        overriddenKeys: [],
        overriddenBasisByKey: {},
      }
    }

    if (fallback.intent === 'override') {
      const basis = fallback.normalizedBasis
      const overriddenKeysFromFallback = fallback.targetKeys
      if (!basis || overriddenKeysFromFallback.length === 0) {
        return this.buildUnclearResult('llm')
      }
      const overriddenBasis = overriddenKeysFromFallback.reduce<Partial<Record<string, StrategyRuleBasis['kind']>>>(
        (acc, key) => {
          acc[key] = basis
          return acc
        },
        {},
      )

      return {
        intent: 'override',
        source: 'llm',
        confirmedKeys: [],
        overriddenKeys: overriddenKeysFromFallback,
        overriddenBasisByKey: overriddenBasis,
      }
    }

    return this.buildUnclearResult('llm')
  }

  private buildUnclearResult(source: InferredConfirmationSource = 'rule'): InferredConfirmationClassification {
    return {
      intent: 'unclear',
      source,
      confirmedKeys: [],
      overriddenKeys: [],
      overriddenBasisByKey: {},
    }
  }

  private splitClauses(message: string): string[] {
    return message
      .split(/[，。；;\n]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private resolveClauseTargets(
    clause: string,
    activeKeys: ReadonlySet<InferredConfirmationDecisionKey>,
  ): InferredConfirmationDecisionKey[] {
    const targets: InferredConfirmationDecisionKey[] = []
    if (activeKeys.has('risk.stopLossBasis') && /止损|亏损/u.test(clause)) {
      targets.push('risk.stopLossBasis')
    }
    if (activeKeys.has('risk.takeProfitBasis') && /止盈|盈利|收益率|收益|利润/u.test(clause)) {
      targets.push('risk.takeProfitBasis')
    }
    return targets
  }

  private isRejectClause(
    clause: string,
    isQuestionClause: boolean,
    clauseTargets: ReadonlyArray<InferredConfirmationDecisionKey>,
  ): boolean {
    if (isQuestionClause) {
      return true
    }

    const compact = clause.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    if (!compact) {
      return false
    }

    if (
      clauseTargets.length > 0
      && /(?:不要按这个|别按这个|不要默认|别按默认|不要按默认|别按默认值|默认不要|默认别)/u.test(compact)
    ) {
      return false
    }

    if (
      /(?:不对|不是这个|不行|别这样|不成立|不确认|不需要|不用|算了|有问题|再改改|默认不对|默认不行|默认不好|默认不合适|默认不能)/u.test(compact)
      || /(?:不是默认)/u.test(compact)
    ) {
      return true
    }

    return /(?:不|别|不要|不是|拒绝|否定)/u.test(compact)
  }

  private isConfirmClause(
    clause: string,
    clauseTargets: ReadonlyArray<InferredConfirmationDecisionKey>,
    isQuestionClause: boolean,
    rawMessage: string,
  ): boolean {
    if (isQuestionClause) {
      return false
    }

    const compact = clause.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    if (!compact) {
      return false
    }
    if (clauseTargets.length === 0 && this.isLongReply(rawMessage)) {
      return false
    }
    if (clauseTargets.length > 0 && this.isLongReply(compact)) {
      return false
    }

    const adjustmentSignal = /(?:更|一点|改|调整|宽|窄|大|小|多|少|提升|缩|扩|幅度|力度|范围)/u.test(compact)

    if (
      clauseTargets.length > 0
      && (
        /没问题/u.test(compact)
        || (!adjustmentSignal && /这样可以(?:了)?/u.test(compact))
        || (!adjustmentSignal && /可以(?:了)?/u.test(compact))
        || /就这样/u.test(compact)
        || /这样对的/u.test(compact)
        || /(这个是对的|这是对的|对的(继续)?)/u.test(compact)
        || /就按这个来/u.test(compact)
        || /按这个(?:来)?/u.test(compact)
        || /这些成立(继续)?/u.test(compact)
        || /(这些推断成立|推断成立)/u.test(compact)
        || /(这个默认是对的|这些默认是对的)/u.test(compact)
        || /(这个推断是对的|这些推断是对的)/u.test(compact)
        || /默认即可/u.test(compact)
        || /按默认(?:值)?(?:来|走)?/u.test(compact)
        || /就按默认/u.test(compact)
        || /这个默认(?:值)?没问题/u.test(compact)
        || /^好的?$/u.test(compact)
        || /^行$/u.test(compact)
        || /^确认$/u.test(compact)
      )
    ) {
      return true
    }

    return [
      /^这样可以(了)?$/u,
      /^可以(了)?$/u,
      /^就这样$/u,
      /^没问题$/u,
      /^这样对的$/u,
      /^(这个是对的|这是对的)$/u,
      /^对的(继续)?$/u,
      /^就按这个来$/u,
      /^按这个(?:来)?$/u,
      /^这些成立(继续)?$/u,
      /^(这些推断成立|推断成立)$/u,
      /^(这个默认是对的|这些默认是对的)$/u,
      /^(这个推断是对的|这些推断是对的)$/u,
      /^默认即可$/u,
      /^按默认(?:值)?(?:来|走)?$/u,
      /^就按默认$/u,
      /^这个默认(?:值)?没问题$/u,
      /^好的?$/u,
      /^行$/u,
      /^确认$/u,
    ].some(pattern => pattern.test(compact))
  }

  private isQuestionClause(clause: string): boolean {
    const compact = clause.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    return /[？?]/u.test(clause) || /[吗么嘛吧呢呗]$/u.test(compact)
  }

  private isLongReply(message: string): boolean {
    const compact = message.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    return compact.length > 16
  }

  private normalizeBasisClarificationAnswer(answer: string): StrategyRuleBasis['kind'] | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) return null

    if (normalized === 'prev_close') return 'prev_close'
    if (normalized === 'entry_avg_price') return 'entry_avg_price'
    if (normalized === 'position_pnl') return 'position_pnl'
    if (normalized === 'peak_equity') return 'peak_equity'
    if (normalized === 'peak_position_pnl') return 'peak_position_pnl'
    if (normalized === 'upper_band') return 'upper_band'
    if (normalized === 'lower_band') return 'lower_band'
    if (normalized === 'middle_band') return 'middle_band'
    if (normalized === 'last_high') return 'last_high'
    if (normalized === 'last_low') return 'last_low'

    if (/上一根|上根|昨收|前收|prev/i.test(normalized)) return 'prev_close'
    if (/开仓均价|入场价|入场均价|开仓价|买入价|成本价|entry/i.test(normalized)) return 'entry_avg_price'
    if (/持仓.*(?:收益|盈亏|亏损|利润|浮盈|pnl)|position.*pnl/i.test(normalized)) return 'position_pnl'
    if (/账户净值峰值|净值峰值|资金曲线峰值|peak equity/i.test(normalized)) return 'peak_equity'
    if (/持仓浮盈峰值|浮盈峰值|peak position pnl/i.test(normalized)) return 'peak_position_pnl'
    if (/上轨|upper band/i.test(normalized)) return 'upper_band'
    if (/下轨|lower band/i.test(normalized)) return 'lower_band'
    if (/中轨|middle band/i.test(normalized)) return 'middle_band'
    if (/前高|last high/i.test(normalized)) return 'last_high'
    if (/前低|last low/i.test(normalized)) return 'last_low'

    return null
  }

  private shouldAttemptFallback(args: {
    message: string
    assistantPrompt: string
    activeKeys: ReadonlySet<InferredConfirmationDecisionKey>
    isConfirmInferredPhase: boolean
  }): boolean {
    if (!args.isConfirmInferredPhase) {
      return false
    }
    if (!args.assistantPrompt) {
      return false
    }
    const compact = args.message.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    if (compact.length === 0 || compact.length > 16) {
      return false
    }
    if (args.activeKeys.size === 0) {
      return false
    }
    if (this.isRejectClause(compact, this.isQuestionClause(compact), [])) {
      return false
    }
    return true
  }

  private async runFallback(args: {
    message: string
    assistantPrompt: string
    activeKeys: InferredConfirmationDecisionKey[]
    pendingKeyDefaults: Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>>
    providerCode?: string
    model?: string
  }): Promise<{ intent: InferredConfirmationFallbackIntent; targetKeys: InferredConfirmationDecisionKey[]; normalizedBasis?: StrategyRuleBasis['kind'] }> {
    if (!this.aiService) {
      return {
        intent: 'unclear',
        targetKeys: [],
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '你是一个严格的确认回复分类器。',
          '只返回 JSON。',
          'intent 只能是 confirm、override 或 unclear。',
          'confirm 表示用户在确认当前待确认项。',
          'override 表示用户在修改某个待确认项的 basis。',
          '如果无法确定，返回 unclear。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `assistantPrompt: ${args.assistantPrompt}`,
          `userReply: ${args.message}`,
          `pendingKeys: ${args.activeKeys.join(', ')}`,
          `pendingKeyDefaults: ${JSON.stringify(args.pendingKeyDefaults)}`,
        ].join('\n'),
      },
    ]

    try {
      const result = await this.aiService.chat({
        providerCode: args.providerCode,
        model: args.model,
        messages,
        temperature: 0,
        maxTokens: 200,
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: 'inferred_confirmation_fallback',
            strict: true,
            schema: FALLBACK_RESPONSE_SCHEMA,
          },
        },
      })
      const parsed = this.parseFallbackResponse(result.content)
      if (!parsed) {
        return { intent: 'unclear', targetKeys: [] }
      }
      const targetKeys = Array.isArray(parsed.targetKeys)
        ? parsed.targetKeys.filter(isInferredConfirmationDecisionKey)
        : []
      if (parsed.intent === 'override') {
        const normalizedBasis = typeof parsed.normalizedBasis === 'string'
          ? this.normalizeBasisClarificationAnswer(parsed.normalizedBasis)
          : null
        if (!normalizedBasis || targetKeys.length === 0) {
          return { intent: 'unclear', targetKeys: [] }
        }
        return {
          intent: 'override',
          targetKeys,
          normalizedBasis,
        }
      }
      if (parsed.intent === 'confirm') {
        return {
          intent: 'confirm',
          targetKeys,
        }
      }
      return { intent: 'unclear', targetKeys: [] }
    }
    catch {
      return { intent: 'unclear', targetKeys: [] }
    }
  }

  private parseFallbackResponse(content: string): InferredConfirmationFallbackResponse | null {
    try {
      const parsed = JSON.parse(content) as Partial<InferredConfirmationFallbackResponse> | null
      if (!parsed || typeof parsed !== 'object') {
        return null
      }
      if (parsed.intent !== 'confirm' && parsed.intent !== 'override' && parsed.intent !== 'unclear') {
        return null
      }
      return {
        intent: parsed.intent,
        targetKeys: parsed.targetKeys,
        normalizedBasis: parsed.normalizedBasis,
      }
    }
    catch {
      return null
    }
  }

  private detectDefaultOverrideKeys(
    message: string,
    activeKeys: ReadonlySet<InferredConfirmationDecisionKey>,
  ): InferredConfirmationDecisionKey[] {
    const targets = new Set<InferredConfirmationDecisionKey>()

    for (const clause of this.splitClauses(message)) {
      const compact = clause.replace(/[\s，。,．！!？?、；;：:]/gu, '')
      if (!compact || !/(?:不要按默认|别按这个|不要默认|别按默认|默认不要|默认别)/u.test(compact)) {
        continue
      }

      if (activeKeys.has('risk.stopLossBasis') && /止损/.test(compact)) {
        targets.add('risk.stopLossBasis')
      }
      if (activeKeys.has('risk.takeProfitBasis') && /止盈/.test(compact)) {
        targets.add('risk.takeProfitBasis')
      }
    }

    return Array.from(targets)
  }

  private buildPendingKeyDefaults(
    defaults: InferredConfirmationSemanticDefaults,
    activeKeys: ReadonlySet<InferredConfirmationDecisionKey>,
  ): Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>> {
    const pendingDefaults: Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>> = {}
    const inferredKeys = new Set(
      Array.isArray(defaults.inferredKeys)
        ? defaults.inferredKeys.filter(isInferredConfirmationDecisionKey)
        : [],
    )

    if (
      activeKeys.has('risk.stopLossBasis')
      && inferredKeys.has('risk.stopLossBasis')
      && defaults.stopLossBasis
    ) {
      pendingDefaults['risk.stopLossBasis'] = defaults.stopLossBasis
    }
    if (
      activeKeys.has('risk.takeProfitBasis')
      && inferredKeys.has('risk.takeProfitBasis')
      && defaults.takeProfitBasis
    ) {
      pendingDefaults['risk.takeProfitBasis'] = defaults.takeProfitBasis
    }
    return pendingDefaults
  }
}
