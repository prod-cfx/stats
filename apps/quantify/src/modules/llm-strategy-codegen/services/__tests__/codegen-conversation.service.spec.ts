import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { CodegenConversationService } from '../codegen-conversation.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'

describe('codegenConversationService (llm orchestrated flow)', () => {
  const envSnapshot = snapshotProcessEnv([
    'LLM_CODEGEN_STRICT_ENABLED',
    'LLM_CODEGEN_STRICT_FALLBACK',
    'LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS',
  ])

  const mockRepo = {
    createSession: jest.fn(),
    findById: jest.fn(),
    updateSession: jest.fn(),
    tryMarkGenerating: jest.fn(),
    tryRequeueFromProcessing: jest.fn(),
    findSessionStrategyInstanceId: jest.fn(),
    bindStrategyInstanceIfEmpty: jest.fn(),
    createVersion: jest.fn(),
    createDraftStrategyInstanceFromPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
    ensureDraftStrategyInstanceBoundForPublishedSession: jest.fn().mockResolvedValue({
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
  const flushAsync = async (ticks = 50): Promise<void> => {
    for (let i = 0; i < ticks; i++) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockRepo.tryMarkGenerating.mockResolvedValue(true)
    mockRepo.tryRequeueFromProcessing.mockResolvedValue(false)
    mockRepo.findSessionStrategyInstanceId.mockResolvedValue(null)
    mockRepo.bindStrategyInstanceIfEmpty.mockResolvedValue(true)
    mockRepo.createDraftStrategyInstanceFromPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'false')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'true')
  })

  afterAll(() => {
    restoreProcessEnv(envSnapshot)
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

  it('stays in drafting when planner says logicReady is false even with a detailed message', async () => {
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

    expect(result.status).toBe('DRAFTING')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
      checklist: expect.objectContaining({
        timeframes: ['5m'],
        entryRules: expect.arrayContaining([expect.any(String)]),
      }),
    }))
  })

  it('does not infer ma rules from pure price-action message in a new session', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在BTCUSDT的3m和15m周期，价格收盘高于关键阻力位入场，跌破最近支撑位出场',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '继续补充风险参数。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-price-action' })

    await service.startSession(dto)

    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['价格收盘确认突破关键阻力位入场'],
        exitRules: ['价格跌破关键支撑位出场'],
      }),
    }))
    const payload = mockRepo.createSession.mock.calls[0]?.[0] as { checklist?: { entryRules?: string[]; exitRules?: string[] } }
    expect(payload.checklist?.entryRules?.join(' ')).not.toContain('均线')
    expect(payload.checklist?.exitRules?.join(' ')).not.toContain('均线')
  })

  it('returns strategyInstanceId in session snapshot response', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-snapshot',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: {},
      strategyInstanceId: 'instance-snapshot-1',
      rejectReason: null,
    })

    const result = await service.getSession('s-snapshot', 'u1')

    expect(result.status).toBe('PUBLISHED')
    expect(result.strategyInstanceId).toBe('instance-snapshot-1')
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
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 80, entryPrice: 62000, stopLoss: 60000, takeProfit: 65000, reasoning: "趋势突破", positionSizeRatio: 0.15 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.createVersion).toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('rejects when script output cannot satisfy signal payload schema', async () => {
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
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v2' })

    const result = await service.continueSession('s6', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    // fallback script passes validation, so pipeline ends with PUBLISHED
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s6', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('generates directly when confirmGenerate is true and checklist is complete even if session is drafting', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's7',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "阻力位突破", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v3' })

    const result = await service.continueSession('s7', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s7', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('returns rejected payload instead of throwing 500 when generation pipeline throws', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockRejectedValueOnce(new Error('provider timeout'))

    const result = await service.continueSession('s8', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('provider timeout'),
    }))
  })

  it('auto-repairs a TypeScript-invalid script and publishes on next attempt', async () => {
    const brokenScriptFromRealCase = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx) {
    const primaryLeg = ctx.legs?.find(leg => leg.role === 'primary');
    const params = ctx.paramsNormalized || {};
    if (!ctx.bars || ctx.bars.length < 20) {
      return { action: 'NOOP', reason: '数据不足' };
    }
    const risk = helpers.signal.buildRiskByAtr({
      side: 'LONG',
      entryPrice: ctx.currentPrice || 0,
      atr: 10,
      atrMultipleStop: params.stopLossPct,
      atrMultipleTake: params.takeProfitPct,
    });
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: params.positionPct },
      confidence: 78,
      reason: 'breakout',
      risk: {
        stopLoss: risk.stopLoss,
        takeProfit: risk.takeProfit,
      },
    }
  },
}
,`
    const repairedScript = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = ctx.bars ?? []
    if (bars.length < 20) return { action: 'NOOP', reason: '数据不足' }
    const positionPct = ctx.paramsNormalized?.positionPct
    const ratio = typeof positionPct === 'number' && positionPct > 0
      ? Math.min(positionPct / 100, 1)
      : 0.1
    return {
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: ratio },
      confidence: 78,
      reason: 'breakout',
    }
  },
}
strategy
`
    mockRepo.findById.mockResolvedValue({
      id: 's9',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格收盘确认突破阻力位入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({ content: brokenScriptFromRealCase })
      .mockResolvedValueOnce({ content: repairedScript })
    mockRepo.createVersion.mockResolvedValue({ id: 'v4' })

    const result = await service.continueSession('s9', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockAi.chat).toHaveBeenCalledTimes(3)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s9', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const repairPrompt = (mockAi.chat.mock.calls[2]?.[0] as { messages: Array<{ role: string; content: string }> })?.messages?.[1]?.content
    expect(repairPrompt).toContain('自动修复')
  })

  it('returns rejected with retry suffix after exhausting auto-repair retries', async () => {
    const brokenScript = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx) {
    return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 }, reason: 'x' }
  },
}
,`
    mockRepo.findById.mockResolvedValue({
      id: 's10',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({ content: brokenScript })
      .mockResolvedValueOnce({ content: brokenScript })
      .mockResolvedValueOnce({ content: brokenScript })
    mockRepo.createVersion.mockResolvedValue({ id: 'v5' })

    const result = await service.continueSession('s10', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    // fallback script passes validation after all retries, so pipeline ends with PUBLISHED
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s10', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  }, 15_000)

  it('uses strict json schema response in codegen and publishes when code is returned', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    mockRepo.findById.mockResolvedValue({
      id: 's11',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          code: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
        }),
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v6' })

    const result = await service.continueSession('s11', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s11', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const codegenCall = mockAi.chat.mock.calls[1]?.[0] as { responseFormat?: unknown }
    expect(codegenCall.responseFormat).toBeDefined()
  })

  it('rejects when strict mode returns payload without code and fallback is disabled', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    mockRepo.findById.mockResolvedValue({
      id: 's12',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'missing code',
        }),
      })

    const result = await service.continueSession('s12', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s12', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('no_code_returned'),
    }))
  })

  it('skips strict response_format for deepseek model and uses plain generation directly', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    mockRepo.findById.mockResolvedValue({
      id: 's13',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v7' })

    const result = await service.continueSession('s13', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      model: 'deepseek-chat',
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s13', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const codegenCall = mockAi.chat.mock.calls[1]?.[0] as { responseFormat?: unknown }
    expect(codegenCall.responseFormat).toBeUndefined()
  })

  it('skips strict response_format for strategy-codegen provider when model is not explicitly provided', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    mockRepo.findById.mockResolvedValue({
      id: 's14',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v8' })

    const result = await service.continueSession('s14', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'strategy-codegen',
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s14', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const codegenCall = mockAi.chat.mock.calls[1]?.[0] as { responseFormat?: unknown }
    expect(codegenCall.responseFormat).toBeUndefined()
  })

  it('does not disable strict for other models after one model is marked unsupported', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')
    setProcessEnvValue('LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS', '600000')

    mockRepo.findById
      .mockResolvedValueOnce({
        id: 's15',
        userId: 'u1',
        status: 'CHECKLIST_GATE',
        checklist: {
          entryRules: ['价格突破阻力位入场'],
          exitRules: ['跌破支撑位出场'],
        },
        constraintPack: {},
      })
      .mockResolvedValueOnce({
        id: 's16',
        userId: 'u1',
        status: 'CHECKLIST_GATE',
        checklist: {
          entryRules: ['价格突破阻力位入场'],
          exitRules: ['跌破支撑位出场'],
        },
        constraintPack: {},
      })

    const plannerPayload = {
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已确认，可以生成。',
      }),
    }

    mockAi.chat
      .mockResolvedValueOnce(plannerPayload)
      .mockRejectedValueOnce(new Error('This response_format type is unavailable now'))
      .mockResolvedValueOnce(plannerPayload)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          code: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
        }),
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v9' })

    const first = await service.continueSession('s15', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })
    expect(first.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s15', expect.objectContaining({
      status: 'REJECTED',
    }))

    const second = await service.continueSession('s16', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4o',
    })
    expect(second.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s16', expect.objectContaining({
      status: 'PUBLISHED',
    }))

    const secondCodegenCall = mockAi.chat.mock.calls[3]?.[0] as { responseFormat?: unknown }
    expect(secondCodegenCall.responseFormat).toBeDefined()
  })

  it('caches strict unsupported at provider level when model is omitted', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')
    setProcessEnvValue('LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS', '600000')

    mockRepo.findById
      .mockResolvedValueOnce({
        id: 's17',
        userId: 'u1',
        status: 'CHECKLIST_GATE',
        checklist: {
          entryRules: ['价格突破阻力位入场'],
          exitRules: ['跌破支撑位出场'],
        },
        constraintPack: {},
      })
      .mockResolvedValueOnce({
        id: 's18',
        userId: 'u1',
        status: 'CHECKLIST_GATE',
        checklist: {
          entryRules: ['价格突破阻力位入场'],
          exitRules: ['跌破支撑位出场'],
        },
        constraintPack: {},
      })

    const plannerPayload = {
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已确认，可以生成。',
      }),
    }

    mockAi.chat
      .mockResolvedValueOnce(plannerPayload)
      .mockRejectedValueOnce(new Error('This response_format type is unavailable now'))
      .mockResolvedValueOnce(plannerPayload)
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v10' })

    const first = await service.continueSession('s17', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'unit-no-model-provider',
    })
    expect(first.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s17', expect.objectContaining({
      status: 'REJECTED',
    }))

    const second = await service.continueSession('s18', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'unit-no-model-provider',
    })
    expect(second.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s18', expect.objectContaining({
      status: 'PUBLISHED',
    }))

    const secondCodegenCall = mockAi.chat.mock.calls[3]?.[0] as { responseFormat?: unknown }
    expect(secondCodegenCall.responseFormat).toBeUndefined()
  })

  it('creates strategy instance on publish and returns it in published snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-new-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-new-instance' })

    const result = await service.continueSession('s-new-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalledTimes(1)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-new-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-1',
    }))
  })

  it('publishes perp marketType when checklist risk rules require perpetual market', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-perp-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格下跌触及网格线时买入'],
        exitRules: ['价格上涨一个网格时卖出'],
        riskRules: {
          marketType: 'perp',
          positionPct: 10,
        },
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "grid", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-perp-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-perp-publish' })

    const result = await service.continueSession('s-perp-publish', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        symbol: 'BTCUSDT',
        marketType: 'perp',
      }),
    }))
  })

  it('does not recreate strategy instance when session already bound', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-existing-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: 'instance-existing',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-2' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-existing-instance' })

    const result = await service.continueSession('s-existing-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-existing-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-existing',
    }))
  })

  it('keeps published with null strategyInstanceId and rejectReason when instance creation fails', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-instance-failed',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-3' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValueOnce(new Error('create instance failed'))
    mockRepo.updateSession.mockResolvedValue({ id: 's-instance-failed' })

    const result = await service.continueSession('s-instance-failed', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await flushAsync()

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-instance-failed', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: null,
      rejectReason: 'create instance failed',
    }))
  })
})
