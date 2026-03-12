import type { LlmCodegenSessionStatus, Prisma } from '@prisma/client'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { CodegenChecklist } from './checklist-gate.service'
import type { ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'

import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { AiService } from '@/modules/ai/ai.service'
import { createDefaultConstraintPack } from '../constants/constraint-pack'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { ChecklistGateService } from './checklist-gate.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { RecommendationIndexService } from './recommendation-index.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { RuntimeGuardrailService } from './runtime-guardrail.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { SpecDescBuilderService } from './spec-desc-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
import { StaticGuardrailService } from './static-guardrail.service'

interface ChecklistPayload {
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
}

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
    const checklist = this.extractChecklist(dto)
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
      assistantPrompt: this.buildGuidePrompt(missing),
    }
  }

  async continueSession(sessionId: string, dto: ContinueCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    const session = await this.sessionsRepo.findById(sessionId)
    if (!session || session.userId !== dto.userId) {
      throw new DomainException('浼氳瘽涓嶅瓨鍦?, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { sessionId },
      })
    }
    if (CodegenConversationService.isTerminalStatus(session.status)) {
      throw new DomainException('浼氳瘽宸茬粓鎬侊紝涓嶈兘缁х画鍐欏叆', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
    }

    const mergedChecklist = this.normalizeChecklist(this.checklistGate.mergeChecklist(
      this.readChecklist(session.checklist),
      this.extractChecklist(dto),
    ))

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
        assistantPrompt: this.buildGuidePrompt(missing),
      }
    }

    try {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'GENERATING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        rejectReason: null,
      })

      const scriptCode = await this.generateScript(mergedChecklist, dto.message)

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

  private extractChecklist(input: StartCodegenSessionDto | ContinueCodegenSessionDto): ChecklistPayload {
    return {
      symbols: input.symbols,
      timeframes: input.timeframes,
      entryRules: input.entryRules,
      exitRules: input.exitRules,
      riskRules: input.riskRules,
    }
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

  private buildGuidePrompt(missing: string[]): string {
    if (missing.length === 0) {
      return '淇℃伅宸查綈鍏紝灏嗗紑濮嬬敓鎴愬苟鏍￠獙绛栫暐鑴氭湰銆?
    }
    return `杩樼己灏戜互涓嬩俊鎭細${missing.join(', ')}銆傝琛ュ厖鍚庡啀鐢熸垚銆俙
  }

  private async generateScript(checklist: ChecklistPayload, userMessage: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '浣犳槸閲忓寲绛栫暐鑴氭湰鐢熸垚鍣ㄣ€?,
          '鍙兘杈撳嚭 JavaScript 鑴氭湰浠ｇ爜锛屼笉瑕佷娇鐢?markdown 浠ｇ爜鍧椼€?,
          '鍙兘浣跨敤 helpers.math/helpers.array/helpers.ta/helpers.signal銆?,
          '绂佹浣跨敤 import/require/eval/Function/process銆?,
          '鑴氭湰蹇呴』杩斿洖闈炵┖瀵硅薄銆?,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `闇€姹? ${userMessage}\n绾︽潫: ${JSON.stringify(checklist)}`,
      },
    ]

    const result = await this.aiService.chat({
      messages,
      temperature: 0.2,
      maxTokens: 1000,
    })

    const code = result.content?.trim()
    if (!code) {
      throw new DomainException('绛栫暐鑴氭湰鐢熸垚澶辫触锛氭ā鍨嬫湭杩斿洖鑴氭湰', {
        code: ErrorCode.AI_PROVIDER_ERROR,
        status: HttpStatus.BAD_GATEWAY,
      })
    }

    return code
  }

  static isTerminalStatus(status: LlmCodegenSessionStatus): boolean {
    return status === 'PUBLISHED' || status === 'REJECTED'
  }
}
