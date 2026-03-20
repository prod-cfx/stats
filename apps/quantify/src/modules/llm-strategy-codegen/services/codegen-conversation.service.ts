import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import type { CodegenChecklist } from './checklist-gate.service'
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
import { ChecklistGateService } from './checklist-gate.service'
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

interface GenerationOptions {
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

const ALLOWED_HELPER_CATEGORIES = ['finance', 'array', 'ta', 'signal'] as const
const MAX_HELPER_SIGNATURE_LINES = 24
const DEFAULT_PROVIDER_CODE = 'strategy-codegen'
const DEFAULT_MODEL = 'gpt-4'

@Injectable()
export class CodegenConversationService {
  constructor(
    private readonly aiService: AiService,
    private readonly sessionsRepo: CodegenSessionsRepository,
    private readonly checklistGate: ChecklistGateService,
    private readonly staticGuardrail: StaticGuardrailService,
    private readonly runtimeGuardrail: RuntimeGuardrailService,
    private readonly specDescBuilder: SpecDescBuilderService,
    private readonly recommendationIndex: RecommendationIndexService,
  ) {}

  async startSession(dto: StartCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    const checklist = this.normalizeChecklist(this.checklistGate.mergeChecklist(
      this.extractChecklist(dto),
      this.inferChecklistFromMessage(dto.initialMessage),
    ))
    const missing = this.checklistGate.getMissingFields(checklist)
    const status: LlmCodegenSessionStatus = missing.length > 0 ? 'DRAFTING' : 'CHECKLIST_GATE'

    const session = await this.sessionsRepo.createSession({
      userId: dto.userId,
      status,
      checklist: checklist as Prisma.InputJsonValue,
      constraintPack: createDefaultConstraintPack() as unknown as Prisma.InputJsonValue,
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
    })

    return {
      id: session.id,
      status,
      missingFields: missing,
      assistantPrompt: this.buildGuidePrompt(missing, dto.initialMessage),
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

    const mergedChecklist = this.normalizeChecklist(
      this.checklistGate.mergeChecklist(
        this.checklistGate.mergeChecklist(
          this.readChecklist(session.checklist),
          this.inferChecklistFromMessage(dto.message),
        ),
        this.extractChecklist(dto),
      ),
    )

    const missing = this.checklistGate.getMissingFields(mergedChecklist)
    if (missing.length > 0) {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'DRAFTING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
      })

      return {
        id: session.id,
        status: 'DRAFTING',
        missingFields: missing,
        assistantPrompt: this.buildGuidePrompt(missing, dto.message),
      }
    }

    const providerCode = this.resolveProviderCode(dto.providerCode)
    try {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'GENERATING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
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

      const runtimeResult = await this.runtimeGuardrail.validate(scriptCode)
      if (!runtimeResult.runtimePassed || !runtimeResult.outputPassed) {
        await this.sessionsRepo.createVersion({
          session: { connect: { id: session.id } },
          scriptCode,
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
          scriptCode,
          rejectReason: runtimeResult.reason,
        }
      }

      await this.sessionsRepo.updateSession(session.id, {
        status: 'VALIDATING_OUTPUT',
      })

      const specDesc = this.specDescBuilder.build(mergedChecklist, scriptCode)

      const version = await this.sessionsRepo.createVersion({
        session: { connect: { id: session.id } },
        scriptCode,
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
        latestDraftCode: scriptCode,
        rejectReason: null,
      })

      return {
        id: session.id,
        status: 'PUBLISHED',
        scriptCode,
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
    const missing = this.checklistGate.getMissingFields(checklist)
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

    const timeframeMatches = Array.from(text.matchAll(/(\d{1,4})\s*(m|min|分钟|h|小时|d|天)/gi))
    const timeframes = Array.from(new Set(timeframeMatches.map(([, value, unit]) => {
      const normalizedUnit = unit.toLowerCase()
      if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
      if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
      return `${value}d`
    })))

    const entryRules: string[] = []
    const exitRules: string[] = []
    if (/金叉|上穿|突破|入场|开仓|买入/.test(text)) {
      entryRules.push('短均线上穿长均线（金叉）入场')
    }
    if (/死叉|跌破|止盈|止损|回撤|平仓|离场|出场|卖出/.test(text)) {
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
    const positionMatch = text.match(/仓位\s*(\d+(?:\.\d+)?)\s*%/i)
    if (positionMatch?.[1]) {
      riskRules.positionPct = Number(positionMatch[1])
    }
    const stopLossMatch = text.match(/止损\s*(\d+(?:\.\d+)?)\s*%/i)
    if (stopLossMatch?.[1]) {
      riskRules.stopLossPct = Number(stopLossMatch[1])
    }
    const drawdownMatch = text.match(/最大回撤\s*(\d+(?:\.\d+)?)\s*%/i)
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

  private normalizeChecklist(payload: CodegenChecklist | Record<string, unknown>): ChecklistPayload {
    const normalizeStringArray = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) return undefined
      return value.filter(item => typeof item === 'string') as string[]
    }

    const normalizeObject = (value: unknown): Record<string, unknown> | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      return value as Record<string, unknown>
    }

    return {
      symbols: normalizeStringArray(payload.symbols),
      timeframes: normalizeStringArray(payload.timeframes),
      entryRules: normalizeStringArray(payload.entryRules),
      exitRules: normalizeStringArray(payload.exitRules),
      riskRules: normalizeObject(payload.riskRules),
    }
  }

  private buildGuidePrompt(missing: string[], userMessage?: string): string {
    if (missing.length === 0) {
      return '信息已齐全，将开始生成并校验策略脚本。'
    }
    const text = (userMessage ?? '').trim()
    const isMovingAverageIntent = /均线|ma|moving average/i.test(text)
    const opener = isMovingAverageIntent
      ? '明白了，你想做一个均线策略。为了直接给你可运行版本，我先确认这几项：'
      : '收到，我先把关键信息确认一下，这样下一步可以直接生成策略：'

    const questionBodies: string[] = []
    if (missing.includes('symbols')) {
      questionBodies.push('做哪个交易标的？例如 BTCUSDT 或 ETHUSDT。')
    }
    if (missing.includes('timeframes')) {
      questionBodies.push('你想用什么周期？例如 5m 做信号、1h 做趋势过滤。')
    }
    if (missing.includes('entryRules')) {
      questionBodies.push(isMovingAverageIntent
        ? '入场规则想用哪组均线？例如 5/20 金叉入场。'
        : '入场条件是什么？例如 “15m 内回撤 1% 后买入”。')
    }
    if (missing.includes('exitRules')) {
      questionBodies.push(isMovingAverageIntent
        ? '出场规则怎么定？例如 5/20 死叉或跌破 20MA 出场。'
        : '出场条件是什么？例如 “上涨 2% 止盈或回撤 1.5% 止损”。')
    }
    if (missing.includes('riskRules')) {
      questionBodies.push('风控偏好是什么？例如 仓位 10%、止损 2%、最大回撤 15%。')
    }

    const questions = questionBodies.map((q, idx) => `${idx + 1}) ${q}`)
    const compactReplyTemplate = '你可以直接回：标的=BTCUSDT；周期=5m/15m；入场=5/20金叉；出场=5/20死叉；风控=仓位10% 止损2% 最大回撤15%。'
    return `${opener}\n${questions.join('\n')}\n${compactReplyTemplate}`
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

    const code = result.content?.trim()
    if (!code) {
      throw new DomainException('策略脚本生成失败：模型未返回脚本', {
        code: ErrorCode.AI_PROVIDER_ERROR,
        status: HttpStatus.BAD_GATEWAY,
      })
    }

    return code
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
