import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'

describe('codegenConversationService (llm orchestrated flow)', () => {
  const mockRepo = {
    createSession: jest.fn(),
    findById: jest.fn(),
    updateSession: jest.fn(),
    createVersion: jest.fn(),
    createDraftStrategyInstanceFromPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
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
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    new SpecDescBuilderService(),
    mockRecommendation as unknown as RecommendationIndexService,
  )

  beforeEach(() => {
    jest.resetAllMocks()
    mockRepo.createDraftStrategyInstanceFromPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
  })

  it('starts in drafting and asks next key question from llm planner', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '帮我做一个均线策略',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '先确认入场条件：例如 5/20 金叉。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's1' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual([])
    expect(result.assistantPrompt).toContain('先确认入场条件')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
    }))
  })

  it('starts in checklist gate when llm says logic is ready', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '3分钟跌1%买入，5分钟涨2%卖出',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['3m 内下跌 1% 买入'],
          exitRules: ['5m 内上涨 2% 卖出'],
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's2' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.assistantPrompt).toContain('确认逻辑图')
  })

  it('promotes a complete execution template to checklist gate even when planner keeps asking follow-up questions', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: [
        '平台：OKX',
        '类型：现货',
        '交易对：SOL/USDT',
        '账户余额：1000 USDT',
        '开仓：市价买入 100 USDT',
        '交易周期：5 分钟',
        '止盈：涨幅达到 2% 市价卖出',
        '止损：最大亏损 10% 市价卖出',
      ].join('\n'),
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '为了完善策略，请补充短均线和长均线周期。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-execution-template' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'CHECKLIST_GATE',
      checklist: expect.objectContaining({
        symbols: ['SOLUSDT'],
        timeframes: ['5m'],
        entryRules: ['5m 周期开盘时市价买入 100 USDT'],
      }),
    }))
  })

  it('keeps drafting and returns unrelated guidance when planner marks message unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's3',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s3', {
      userId: 'u1',
      message: 'hi',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('无关')
    expect(mockRepo.updateSession).not.toHaveBeenCalled()
  })

  it('moves to checklist gate when llm planner marks logic ready', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['短均线上穿长均线（金叉）入场'],
          exitRules: ['短均线下穿长均线（死叉）出场'],
        },
      }),
    })

    const result = await service.continueSession('s4', {
      userId: 'u1',
      message: '入场用金叉，出场用死叉',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({
      status: 'CHECKLIST_GATE',
    }))
  })

  it('publishes after confirmGenerate with planner+generator pipeline', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '已确认逻辑，开始生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY" }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('PUBLISHED')
    expect(result.scriptCode).toContain('return { direction: "BUY" }')
    expect(mockRepo.createVersion).toHaveBeenCalled()
  })

  it('auto-fixes script when runtime output is string', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's6',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '可以生成',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return "BUY"',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v2' })

    const result = await service.continueSession('s6', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    })

    expect(result.status).toBe('PUBLISHED')
    expect(result.scriptCode).toContain('return { signal: __result };')
  })
})
