import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { ChecklistGateService } from '../checklist-gate.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'

describe('codegenConversationService', () => {
  const mockRepo = {
    createSession: jest.fn(),
    findById: jest.fn(),
    updateSession: jest.fn(),
    createVersion: jest.fn(),
  }
  const mockAi = {
    chat: jest.fn(),
  }
  const mockRecommendation = {
    onSpecDescPersisted: jest.fn(),
  }

  const service = new CodegenConversationService(
    mockAi as unknown as AiService,
    mockRepo as unknown as CodegenSessionsRepository,
    new ChecklistGateService(),
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    new SpecDescBuilderService(),
    mockRecommendation as unknown as RecommendationIndexService,
  )

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('keeps drafting when checklist incomplete', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
    }

    mockRepo.createSession.mockResolvedValue({ id: 's1' })

    const result = await service.startSession(dto)
    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual(expect.arrayContaining(['entryRules']))
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFTING' }))
  })

  it('persists CHECKLIST_GATE when checklist complete at start', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }

    mockRepo.createSession.mockResolvedValue({ id: 's2' })

    const result = await service.startSession(dto)
    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({ status: 'CHECKLIST_GATE' }))
  })

  it('publishes when all checks pass', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
      },
    })
    mockAi.chat.mockResolvedValue({ content: 'return { direction: "BUY" }' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '生成策略',
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }

    const result = await service.continueSession('s1', dto)

    expect(result.status).toBe('PUBLISHED')
    expect(result.specDesc).toBeTruthy()
    expect(mockRepo.createVersion).toHaveBeenCalled()
  })

  it('rejects continuation for terminal sessions', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's3',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
    })

    await expect(service.continueSession('s3', { userId: 'u1', message: '继续生成' })).rejects.toThrow('会话已终态')
  })

  it('converges session status to REJECTED when generation throws', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
      },
    })
    mockAi.chat.mockRejectedValue(new Error('provider down'))

    await expect(service.continueSession('s4', { userId: 'u1', message: '生成策略' })).rejects.toThrow('provider down')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({ status: 'REJECTED' }))
  })

})
