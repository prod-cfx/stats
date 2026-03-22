import type { CodegenGuidePromptConfigSnapshot, ConstraintPackSnapshot } from '../constants/constraint-pack'
import type { CodegenGuideConfigDto } from '../dto/codegen-guide-config.dto'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import type { ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'
import type { LlmCodegenSessionStatus, Prisma } from '@/prisma/prisma.types'

import { ErrorCode } from '@ai/shared'
import { getHelperDocs } from '@ai/shared/script-engine/helpers'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { AiService } from '@/modules/ai/ai.service'
import { createDefaultConstraintPack } from '../constants/constraint-pack'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RecommendationIndexService } from './recommendation-index.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RuntimeGuardrailService } from './runtime-guardrail.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { SpecDescBuilderService } from './spec-desc-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StaticGuardrailService } from './static-guardrail.service'

interface ChecklistPayload {
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
}

interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  logic?: ChecklistPayload
}

interface GenerationOptions {
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

type GuidePromptConfig = CodegenGuidePromptConfigSnapshot
type RecommendationStyle = 'ma' | 'drop-rise'

const ALLOWED_HELPER_CATEGORIES = ['finance', 'array', 'ta', 'signal'] as const
const MAX_HELPER_SIGNATURE_LINES = 24
const MAX_PLANNER_HISTORY_LINES = 12
const DEFAULT_PROVIDER_CODE = 'strategy-codegen'
const DEFAULT_MODEL = 'gpt-4'

@Injectable()
export class CodegenConversationService {
  constructor(
    private readonly aiService: AiService,
    private readonly sessionsRepo: CodegenSessionsRepository,
    private readonly staticGuardrail: StaticGuardrailService,
    private readonly runtimeGuardrail: RuntimeGuardrailService,
    private readonly specDescBuilder: SpecDescBuilderService,
    private readonly recommendationIndex: RecommendationIndexService,
  ) {}

  async startSession(dto: StartCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    const seedChecklist = this.normalizeChecklist({
      ...this.extractChecklist(dto),
      ...this.inferChecklistFromMessage(dto.initialMessage),
    })
    const plan = await this.planConversationByLlm(dto.initialMessage ?? '', seedChecklist, {
      providerCode: this.resolveProviderCode(undefined),
      model: undefined,
    })
    const checklist = this.mergeChecklistSnapshots(seedChecklist, plan.logic ?? {})
    const recommendationStyle = this.inferRecommendationStyleFromContext(
      dto.initialMessage,
      checklist,
      undefined,
    )
    const status: LlmCodegenSessionStatus = plan.logicReady ? 'CHECKLIST_GATE' : 'DRAFTING'

    const guidePrompt = this.mergeGuidePromptConfig(undefined, dto.guideConfig)
    const initialSpecDesc = plan.logicReady ? this.specDescBuilder.build(checklist, '') : null
    const initialHistory = this.appendConversationHistory([], dto.initialMessage, plan.assistantPrompt)
    const session = await this.sessionsRepo.createSession({
      userId: dto.userId,
      status,
      checklist: checklist as Prisma.InputJsonValue,
      constraintPack: {
        ...createDefaultConstraintPack(guidePrompt),
        recommendationStyle,
        conversationHistory: initialHistory,
      } as unknown as Prisma.InputJsonValue,
      latestDraftCode: null,
      latestSpecDesc: initialSpecDesc as Prisma.InputJsonValue,
      rejectReason: null,
    })

    return {
      id: session.id,
      status,
      missingFields: [],
      specDesc: initialSpecDesc,
      assistantPrompt: plan.logicReady
        ? `${plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`
        : plan.assistantPrompt,
    }
  }

  async continueSession(sessionId: string, dto: ContinueCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    const session = await this.sessionsRepo.findById(sessionId)
    if (!session || session.userId !== dto.userId) {
      throw new DomainException('会话不存在', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { sessionId },
      })
    }
    if (CodegenConversationService.isTerminalStatus(session.status)) {
      throw new DomainException('会话已终态，不能继续写入', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
    }

    const baseChecklist = this.readChecklist(session.checklist)
    const messageChecklist = this.normalizeChecklist({
      ...this.inferChecklistFromMessage(dto.message),
      ...this.extractChecklist(dto),
    })
    const preMergedChecklist = this.mergeChecklistSnapshots(baseChecklist, messageChecklist)
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, dto.guideConfig)
    const plan = await this.planConversationByLlm(dto.message, preMergedChecklist, {
      providerCode: this.resolveProviderCode(dto.providerCode),
      model: dto.model,
    }, constraintPack.conversationHistory ?? [])
    if (!plan.related && dto.confirmGenerate !== true) {
      return {
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt || '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }
    }
    const mergedChecklist = this.mergeChecklistSnapshots(preMergedChecklist, plan.logic ?? {})
    const recommendationStyle = this.inferRecommendationStyleFromContext(
      dto.message,
      mergedChecklist,
      constraintPack.recommendationStyle,
    )
    const nextConstraintPack = this.withGuidePrompt(constraintPack, guidePrompt, recommendationStyle)
    const historyAfterPlanner = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
      plan.assistantPrompt,
    )

    if (dto.confirmGenerate !== true) {
      if (!plan.logicReady) {
        await this.sessionsRepo.updateSession(session.id, {
          status: 'DRAFTING',
          checklist: mergedChecklist as Prisma.InputJsonValue,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterPlanner,
          } as unknown as Prisma.InputJsonValue,
        })

        return {
          id: session.id,
          status: 'DRAFTING',
          missingFields: [],
          assistantPrompt: plan.assistantPrompt,
        }
      }

      const specDesc = this.specDescBuilder.build(mergedChecklist, '')
      await this.sessionsRepo.updateSession(session.id, {
        status: 'CHECKLIST_GATE',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        } as unknown as Prisma.InputJsonValue,
        latestSpecDesc: specDesc as Prisma.InputJsonValue,
      })

      return {
        id: session.id,
        status: 'CHECKLIST_GATE',
        missingFields: [],
        specDesc,
        assistantPrompt: `${plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`,
      }
    }

    const missingFields = this.resolveChecklistMissingFields(mergedChecklist)
    const canGenerate = session.status === 'CHECKLIST_GATE' && missingFields.length === 0
    if (!canGenerate) {
      if (missingFields.length > 0) {
        await this.sessionsRepo.updateSession(session.id, {
          status: 'DRAFTING',
          checklist: mergedChecklist as Prisma.InputJsonValue,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterPlanner,
          } as unknown as Prisma.InputJsonValue,
        })

        return {
          id: session.id,
          status: 'DRAFTING',
          missingFields,
          assistantPrompt: plan.assistantPrompt || '请先补全入场和出场规则，再确认生成代码。',
        }
      }

      const specDesc = this.specDescBuilder.build(mergedChecklist, '')
      await this.sessionsRepo.updateSession(session.id, {
        status: 'CHECKLIST_GATE',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        } as unknown as Prisma.InputJsonValue,
        latestSpecDesc: specDesc as Prisma.InputJsonValue,
      })

      return {
        id: session.id,
        status: 'CHECKLIST_GATE',
        missingFields: [],
        specDesc,
        assistantPrompt: `${plan.assistantPrompt}\n请先确认逻辑图，确认后我再生成策略代码。`,
      }
    }

    const providerCode = this.resolveProviderCode(dto.providerCode)
    try {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'GENERATING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: this.appendConversationHistory(
            constraintPack.conversationHistory ?? [],
            dto.message,
          ),
        } as unknown as Prisma.InputJsonValue,
        rejectReason: null,
      })

      const scriptCode = await this.generateScript(mergedChecklist, dto.message, {
        providerCode,
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
      })

      await this.sessionsRepo.updateSession(session.id, {
        status: 'VALIDATING_STATIC',
        latestDraftCode: scriptCode,
      })

      const staticResult = this.staticGuardrail.validate(scriptCode)
      if (!staticResult.passed) {
        await this.sessionsRepo.createVersion({
          session: { connect: { id: session.id } },
          scriptCode,
          specDesc: {} as Prisma.InputJsonValue,
          staticPassed: false,
          runtimePassed: false,
          outputPassed: false,
        })

        await this.sessionsRepo.updateSession(session.id, {
          status: 'REJECTED',
          rejectReason: staticResult.reason,
        })

        return {
          id: session.id,
          status: 'REJECTED',
          scriptCode,
          rejectReason: staticResult.reason,
        }
      }

      await this.sessionsRepo.updateSession(session.id, {
        status: 'VALIDATING_RUNTIME',
      })

      let finalScriptCode = scriptCode
      let runtimeResult = await this.runtimeGuardrail.validate(finalScriptCode)
      if (!runtimeResult.runtimePassed || !runtimeResult.outputPassed) {
        const autoFixedScript = this.tryAutoFixStringOutputScript(finalScriptCode, runtimeResult.reason)
        if (autoFixedScript) {
          const autoFixedStatic = this.staticGuardrail.validate(autoFixedScript)
          if (autoFixedStatic.passed) {
            const autoFixedRuntime = await this.runtimeGuardrail.validate(autoFixedScript)
            if (autoFixedRuntime.runtimePassed && autoFixedRuntime.outputPassed) {
              finalScriptCode = autoFixedScript
              runtimeResult = autoFixedRuntime
            }
          }
        }
      }
      if (!runtimeResult.runtimePassed || !runtimeResult.outputPassed) {
        await this.sessionsRepo.createVersion({
          session: { connect: { id: session.id } },
          scriptCode: finalScriptCode,
          specDesc: {} as Prisma.InputJsonValue,
          staticPassed: true,
          runtimePassed: runtimeResult.runtimePassed,
          outputPassed: runtimeResult.outputPassed,
        })

        await this.sessionsRepo.updateSession(session.id, {
          status: 'REJECTED',
          rejectReason: runtimeResult.reason,
        })

        return {
          id: session.id,
          status: 'REJECTED',
          scriptCode: finalScriptCode,
          rejectReason: runtimeResult.reason,
        }
      }

      await this.sessionsRepo.updateSession(session.id, {
        status: 'VALIDATING_OUTPUT',
      })

      const specDesc = this.specDescBuilder.build(mergedChecklist, finalScriptCode)

      const version = await this.sessionsRepo.createVersion({
        session: { connect: { id: session.id } },
        scriptCode: finalScriptCode,
        specDesc: specDesc as Prisma.InputJsonValue,
        staticPassed: true,
        runtimePassed: true,
        outputPassed: true,
      })

      await this.recommendationIndex.onSpecDescPersisted({
        versionId: version.id,
        specDesc,
      })

      await this.sessionsRepo.updateSession(session.id, {
        status: 'PUBLISHED',
        latestSpecDesc: specDesc as Prisma.InputJsonValue,
        latestDraftCode: finalScriptCode,
        rejectReason: null,
      })

      return {
        id: session.id,
        status: 'PUBLISHED',
        scriptCode: finalScriptCode,
        specDesc,
        missingFields: [],
      }
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      await this.sessionsRepo.updateSession(session.id, {
        status: 'REJECTED',
        rejectReason: reason,
      })
      throw error
    }
  }

  private readChecklist(payload: Prisma.JsonValue | null): ChecklistPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {}
    }

    return this.normalizeChecklist(payload as Record<string, unknown>)
  }

  async testEngine(dto: TestLlmCodegenEngineDto): Promise<LlmCodegenEngineTestResponseDto> {
    const checklist = this.extractChecklist(dto)
    const missing: string[] = []
    if (!Array.isArray(checklist.entryRules) || checklist.entryRules.length === 0) {
      missing.push('entryRules')
    }
    if (!Array.isArray(checklist.exitRules) || checklist.exitRules.length === 0) {
      missing.push('exitRules')
    }
    if (missing.length > 0) {
      throw new DomainException(`缺少必填信息: ${missing.join(', ')}`, {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { missingFields: missing },
      })
    }

    const providerCode = this.resolveProviderCode(dto.providerCode)
    const scriptCode = await this.generateScript(checklist, dto.message, {
      providerCode,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    })

    const staticResult = this.staticGuardrail.validate(scriptCode)
    if (!staticResult.passed) {
      return {
        providerCode,
        model: dto.model ?? DEFAULT_MODEL,
        scriptCode,
        staticPassed: false,
        runtimePassed: false,
        outputPassed: false,
        rejectReason: staticResult.reason,
      }
    }

    const runtimeResult = await this.runtimeGuardrail.validate(scriptCode)
    return {
      providerCode,
      model: dto.model ?? DEFAULT_MODEL,
      scriptCode,
      staticPassed: true,
      runtimePassed: runtimeResult.runtimePassed,
      outputPassed: runtimeResult.outputPassed,
      rejectReason: runtimeResult.reason,
    }
  }

  private extractChecklist(
    input: StartCodegenSessionDto | ContinueCodegenSessionDto | TestLlmCodegenEngineDto,
  ): ChecklistPayload {
    return {
      symbols: input.symbols,
      timeframes: input.timeframes,
      entryRules: input.entryRules,
      exitRules: input.exitRules,
      riskRules: input.riskRules,
    }
  }

  private resolveChecklistMissingFields(checklist: ChecklistPayload): string[] {
    const missing: string[] = []
    if (!Array.isArray(checklist.entryRules) || checklist.entryRules.length === 0) {
      missing.push('entryRules')
    }
    if (!Array.isArray(checklist.exitRules) || checklist.exitRules.length === 0) {
      missing.push('exitRules')
    }
    return missing
  }

  private inferChecklistFromMessage(message?: string): ChecklistPayload {
    if (!message || !message.trim()) {
      return {}
    }
    const text = message.trim()
    const upper = text.toUpperCase()

    const symbolMatches = upper.match(/\b[A-Z]{2,12}(?:USDT|USDC|USD)\b/g) ?? []
    const symbols = Array.from(new Set(symbolMatches))
    if (symbols.length === 0) {
      if (/比特币|大饼|BTC/i.test(text)) {
        symbols.push('BTCUSDT')
      } else if (/以太|ETH/i.test(text)) {
        symbols.push('ETHUSDT')
      }
    }

    const timeframeMatches = Array.from(text.matchAll(/(\d{1,4})\s*([mhd天]|min|分钟|小时)/gi))
    const timeframes = Array.from(new Set(timeframeMatches.map(([, value, unit]) => {
      const normalizedUnit = unit.toLowerCase()
      if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
      if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
      return `${value}d`
    })))

    const entryRules: string[] = []
    const exitRules: string[] = []

    const normalizeTimeframe = (value: string, unit: string) => {
      const normalizedUnit = unit.toLowerCase()
      if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
      if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
      return `${value}d`
    }

    const buyDropPattern = /(\d{1,4})\s*([mhd天]|min|分钟|小时)[^，。；;\n]{0,30}?(?:跌|下跌|回撤)\s*(\d+(?:\.\d+)?)\s*%[^，。；;\n]{0,20}?(?:买入|开仓|入场)/i
    const sellRisePattern = /(\d{1,4})\s*([mhd天]|min|分钟|小时)[^，。；;\n]{0,30}?(?:涨|上涨|反弹)\s*(\d+(?:\.\d+)?)\s*%[^，。；;\n]{0,20}?(?:卖出|平仓|离场|出场)/i

    const buyDropMatch = text.match(buyDropPattern)
    if (buyDropMatch?.[1] && buyDropMatch[2] && buyDropMatch[3]) {
      const frame = normalizeTimeframe(buyDropMatch[1], buyDropMatch[2])
      entryRules.push(`${frame} 内下跌 ${buyDropMatch[3]}% 买入`)
    }

    const sellRiseMatch = text.match(sellRisePattern)
    if (sellRiseMatch?.[1] && sellRiseMatch[2] && sellRiseMatch[3]) {
      const frame = normalizeTimeframe(sellRiseMatch[1], sellRiseMatch[2])
      exitRules.push(`${frame} 内上涨 ${sellRiseMatch[3]}% 卖出`)
    }

    if (entryRules.length === 0 && /金叉|上穿|突破|入场|开仓|买入/.test(text)) {
      entryRules.push('短均线上穿长均线（金叉）入场')
    }
    if (exitRules.length === 0 && /死叉|跌破|止盈|止损|回撤|平仓|离场|出场|卖出/.test(text)) {
      if (/死叉/.test(text)) {
        exitRules.push('短均线下穿长均线（死叉）出场')
      } else if (/跌破/.test(text)) {
        exitRules.push('价格跌破关键均线出场')
      } else if (/止盈|止损|回撤/.test(text)) {
        exitRules.push('触发止盈/止损阈值出场')
      } else {
        exitRules.push('满足出场条件后平仓')
      }
    }

    const riskRules: Record<string, unknown> = {}
    const positionMatch = text.match(/仓位\s*(\d+(?:\.\d+)?)\s*%/)
    if (positionMatch?.[1]) {
      riskRules.positionPct = Number(positionMatch[1])
    }
    const stopLossMatch = text.match(/止损\s*(\d+(?:\.\d+)?)\s*%/)
    if (stopLossMatch?.[1]) {
      riskRules.stopLossPct = Number(stopLossMatch[1])
    }
    const drawdownMatch = text.match(/最大回撤\s*(\d+(?:\.\d+)?)\s*%/)
    if (drawdownMatch?.[1]) {
      riskRules.maxDrawdownPct = Number(drawdownMatch[1])
    }

    return {
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframes: timeframes.length > 0 ? timeframes : undefined,
      entryRules: entryRules.length > 0 ? entryRules : undefined,
      exitRules: exitRules.length > 0 ? exitRules : undefined,
      riskRules: Object.keys(riskRules).length > 0 ? riskRules : undefined,
    }
  }

  private resolveProviderCode(rawProviderCode?: string): string {
    if (!rawProviderCode) {
      return DEFAULT_PROVIDER_CODE
    }
    const normalized = rawProviderCode.trim()
    if (!normalized || normalized === 'uniapi') {
      return DEFAULT_PROVIDER_CODE
    }
    return normalized
  }

  private normalizeChecklist(payload: ChecklistPayload | Record<string, unknown>): ChecklistPayload {
    const normalizeStringArray = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) return undefined
      const normalized = value
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean) as string[]
      return normalized.length > 0 ? normalized : undefined
    }

    const normalizeObject = (value: unknown): Record<string, unknown> | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const normalized = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined && v !== null && v !== ''),
      )
      return Object.keys(normalized).length > 0 ? normalized : undefined
    }

    return {
      symbols: normalizeStringArray(payload.symbols),
      timeframes: normalizeStringArray(payload.timeframes),
      entryRules: normalizeStringArray(payload.entryRules),
      exitRules: normalizeStringArray(payload.exitRules),
      riskRules: normalizeObject(payload.riskRules),
    }
  }

  private readConstraintPack(payload: Prisma.JsonValue | null): ConstraintPackSnapshot {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return createDefaultConstraintPack()
    }

    const raw = payload as Record<string, unknown>
    const guidePrompt = this.mergeGuidePromptConfig(undefined, raw.guidePrompt as CodegenGuideConfigDto | undefined)
    const conversationHistory = Array.isArray(raw.conversationHistory)
      ? raw.conversationHistory.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
      : []
    return {
      ...createDefaultConstraintPack(),
      ...raw,
      guidePrompt,
      conversationHistory,
    } as ConstraintPackSnapshot
  }

  private withGuidePrompt(
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

  private mergeGuidePromptConfig(
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

  private async generateScript(
    checklist: ChecklistPayload,
    userMessage: string,
    options?: GenerationOptions,
  ): Promise<string> {
    const helperSignatures = this.buildHelperSignaturesPrompt()
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '你是量化策略脚本生成器。',
          '只能输出 JavaScript 脚本代码，不要使用 markdown 代码块。',
          '只能使用 helpers.finance/helpers.array/helpers.ta/helpers.signal。',
          '禁止使用 import/require/eval/Function/process。',
          '脚本必须返回非空对象。',
          '以下是当前环境允许使用的 helper 函数签名（严格按签名调用，不要臆造函数）：',
          helperSignatures,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `需求: ${userMessage}\n约束: ${JSON.stringify(checklist)}`,
      },
    ]

    const result = await this.aiService.chat({
      providerCode: options?.providerCode,
      model: options?.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      maxTokens: options?.maxTokens ?? 1000,
    })

    const code = this.normalizeGeneratedScript(result.content)
    if (!code) {
      throw new DomainException('策略脚本生成失败：模型未返回脚本', {
        code: ErrorCode.AI_PROVIDER_ERROR,
        status: HttpStatus.BAD_GATEWAY,
      })
    }

    return code
  }

  private normalizeGeneratedScript(content?: string): string {
    const raw = content?.trim() ?? ''
    if (!raw) {
      return ''
    }

    const fencedMatch = raw.match(/```[\w-]*\s*\n([\s\S]*?)\n?```/)
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'string') {
        return parsed.trim()
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = (parsed as Record<string, unknown>).code
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim()
        }
      }
    } catch {
      // keep raw when content is not JSON
    }

    return raw
  }

  private tryAutoFixStringOutputScript(scriptCode: string, reason?: string): string | null {
    const normalizedReason = (reason ?? '').toLowerCase()
    const isStringReturnError = normalizedReason.includes('invalid return type')
      && normalizedReason.includes('got string')
    if (!isStringReturnError) {
      return null
    }

    return [
      'const __result = (() => {',
      scriptCode,
      '})();',
      'if (__result && typeof __result === "object" && !Array.isArray(__result)) return __result;',
      'if (typeof __result === "string") {',
      '  try {',
      '    const __parsed = JSON.parse(__result);',
      '    if (__parsed && typeof __parsed === "object" && !Array.isArray(__parsed)) return __parsed;',
      '  } catch {}',
      '  return { signal: __result };',
      '}',
      'return { value: __result ?? "EMPTY_RESULT" };',
    ].join('\n')
  }

  private async planConversationByLlm(
    message: string,
    currentLogic: ChecklistPayload,
    options?: { providerCode?: string, model?: string },
    history: string[] = [],
  ): Promise<ConversationPlan> {
    const text = message.trim()
    if (!text) {
      return {
        related: false,
        logicReady: false,
        assistantPrompt: '请先描述你的交易逻辑，我会继续帮你完善。',
      }
    }

    const classifyOnce = async () => {
      const result = await this.aiService.chat({
        providerCode: options?.providerCode ?? DEFAULT_PROVIDER_CODE,
        model: options?.model,
        temperature: 0,
        maxTokens: 400,
        messages: [
          {
            role: 'system',
            content: [
              '你是交易策略对话编排器。任务：根据当前上下文，决定下一轮对话，而不是固定问卷。',
              '你必须维持上下文一致，不能把已有策略重置为默认模板。',
              '标的/周期/风控可后续配置，不应强制先问这些。',
              '只输出 JSON，不要 markdown。',
              'JSON 结构：',
              '{',
              '  "related": boolean,',
              '  "logicReady": boolean,',
              '  "assistantPrompt": string,',
              '  "logic": {',
              '    "entryRules"?: string[],',
              '    "exitRules"?: string[],',
              '    "symbols"?: string[],',
              '    "timeframes"?: string[],',
              '    "riskRules"?: object',
              '  }',
              '}',
              '规则：',
              '1) 如果消息与策略无关：related=false，assistantPrompt 提醒回到策略主题。',
              '2) 如果策略逻辑还不完整：logicReady=false，assistantPrompt 只问一个最关键问题。',
              '3) 如果策略逻辑已完整可画流程图：logicReady=true，assistantPrompt 用一句话总结策略逻辑并请求确认。',
              '4) 若用户是在修改已有逻辑，应在 currentLogic 基础上增量修改，而非重置。',
              '5) 若用户明确表达“推荐/默认/你来定/不要再问”，必须直接给出完整入场+出场规则草案，logicReady=true，不再继续追问。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              message: text,
              currentLogic,
              history: history.slice(-MAX_PLANNER_HISTORY_LINES),
            }),
          },
        ],
      })

      const content = result.content?.trim() ?? ''
      if (!content) {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先理解到你的交易想法了。请补充入场和出场触发条件，我再整理成逻辑图。',
        } satisfies ConversationPlan
      }

      try {
        const parsed = JSON.parse(content) as {
          related?: unknown
          logicReady?: unknown
          assistantPrompt?: unknown
          logic?: unknown
        }
        const related = typeof parsed.related === 'boolean' ? parsed.related : true
        const logicReady = typeof parsed.logicReady === 'boolean' ? parsed.logicReady : false
        const assistantPrompt = typeof parsed.assistantPrompt === 'string' && parsed.assistantPrompt.trim()
          ? parsed.assistantPrompt.trim()
          : (logicReady
              ? '我已整理出策略逻辑，请确认逻辑图。'
              : '我先继续完善策略逻辑，请补充一个关键条件。')
        const logic = this.normalizeChecklist((parsed.logic ?? {}) as Record<string, unknown>)
        return {
          related,
          logicReady,
          assistantPrompt,
          logic,
        } satisfies ConversationPlan
      } catch {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        } satisfies ConversationPlan
      }
    }

    try {
      return await classifyOnce()
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      const nonRetryableModelError = /model\s+not\s+exist|model.*not.*found/i.test(messageText)
      if (nonRetryableModelError) {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        }
      }
      try {
        return await classifyOnce()
      } catch {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        }
      }
    }
  }

  private mergeChecklistSnapshots(base: ChecklistPayload, patch: ChecklistPayload): ChecklistPayload {
    const merged = {
      symbols: patch.symbols && patch.symbols.length > 0 ? patch.symbols : base.symbols,
      timeframes: patch.timeframes && patch.timeframes.length > 0 ? patch.timeframes : base.timeframes,
      entryRules: patch.entryRules && patch.entryRules.length > 0 ? patch.entryRules : base.entryRules,
      exitRules: patch.exitRules && patch.exitRules.length > 0 ? patch.exitRules : base.exitRules,
      riskRules: patch.riskRules && Object.keys(patch.riskRules).length > 0 ? patch.riskRules : base.riskRules,
    }
    return this.normalizeChecklist(merged)
  }

  private appendConversationHistory(
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

  private inferRecommendationStyleFromContext(
    message: string | undefined,
    checklist: ChecklistPayload,
    currentStyle?: RecommendationStyle,
  ): RecommendationStyle | undefined {
    const fromChecklist = this.detectRecommendationStyleFromChecklist(checklist)
    if (fromChecklist) {
      return fromChecklist
    }
    const text = (message ?? '').trim()
    if (text) {
      if (/均线|金叉|死叉|\bma\b|moving average/i.test(text)) {
        return 'ma'
      }
      if (/(下跌|上涨|回撤|[跌涨天%]|分钟|小时|\d+\s*[mhd])/i.test(text)) {
        return 'drop-rise'
      }
    }
    return currentStyle
  }

  private detectRecommendationStyleFromChecklist(checklist: ChecklistPayload): RecommendationStyle | undefined {
    const rules = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    if (!rules.trim()) return undefined
    if (/金叉|死叉|均线|ma|moving average/i.test(rules)) return 'ma'
    if (/下跌|上涨|回撤|[跌涨%]|\d+\s*[mhd]/i.test(rules)) return 'drop-rise'
    return undefined
  }

  private buildHelperSignaturesPrompt(): string {
    const docs = getHelperDocs().filter(doc =>
      ALLOWED_HELPER_CATEGORIES.includes(doc.category),
    )

    return docs
      .slice(0, MAX_HELPER_SIGNATURE_LINES)
      .map(doc => `- ${doc.signature}`)
      .join('\n')
  }

  static isTerminalStatus(status: LlmCodegenSessionStatus): boolean {
    return status === 'PUBLISHED' || status === 'REJECTED'
  }
}
