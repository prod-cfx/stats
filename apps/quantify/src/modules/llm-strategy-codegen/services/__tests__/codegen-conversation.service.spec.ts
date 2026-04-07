import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

describe('codegenConversationService (llm orchestrated flow)', () => {
  jest.setTimeout(120_000)

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
    create: jest.fn(),
    findLatestBySessionId: jest.fn(),
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
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()

  const service = new CodegenConversationService(
    mockAi as unknown as AiService,
    mockRepo as unknown as CodegenSessionsRepository,
    mockRepo as unknown as PublishedStrategySnapshotsRepository,
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    new SpecDescBuilderService(canonicalSpecBuilder),
    canonicalSpecBuilder,
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    mockRecommendation as unknown as RecommendationIndexService,
    new StrategyClarificationRulesService(),
    new StrategyClarificationQuestionService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
  )
  const waitForTerminalStatus = async (
    sessionId: string,
    timeoutMs = 20_000,
  ): Promise<void> => {
    const startedAt = Date.now()
    while (Date.now() - startedAt <= timeoutMs) {
      const hasTerminal = mockRepo.updateSession.mock.calls.some((call) => {
        const currentId = call[0] as string
        const payload = call[1] as { status?: string }
        return currentId === sessionId
          && (payload.status === 'PUBLISHED' || payload.status === 'CONSISTENCY_FAILED' || payload.status === 'REJECTED')
      })
      if (hasTerminal) return
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    throw new Error(`timed out waiting for terminal status: ${sessionId}`)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockRepo.tryMarkGenerating.mockResolvedValue(true)
    mockRepo.tryRequeueFromProcessing.mockResolvedValue(false)
    mockRepo.findSessionStrategyInstanceId.mockResolvedValue(null)
    mockRepo.bindStrategyInstanceIfEmpty.mockResolvedValue(true)
    mockRepo.create.mockResolvedValue({
      id: 'snapshot-1',
      consistencyReport: {},
    })
    mockRepo.findLatestBySessionId.mockResolvedValue(null)
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

  it('stays in DRAFTING when an entry rule can resolve to both OPEN_LONG and OPEN_SHORT', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨交易，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('当前这条规则还缺少方向约束')
    expect(result.assistantPrompt).toContain('是只做空，还是也允许做多')
  })

  it('preserves explicit direction in bollinger fallback inference and does not ask direction clarification', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-2' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨做空，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
      }),
      clarificationState: expect.objectContaining({ status: 'CLEAR' }),
    }))
  })

  it('keeps direction ambiguous when only exit wording includes sell action', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-3' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨交易，回到中轨卖出，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({ status: 'NEEDS_CLARIFICATION' }),
    }))
  })

  it('keeps direction ambiguous for same-sentence no-comma exit wording after upper-band trigger', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-4' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨交易后回到中轨卖出，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({ status: 'NEEDS_CLARIFICATION' }),
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
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-session-1',
      consistencyReport: {
        status: 'PASSED',
      },
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-snapshot',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-session-old',
        consistencyReport: { status: 'FAILED' },
      },
      strategyInstanceId: 'instance-snapshot-1',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'rule.entry.upper_band.side_scope',
            reason: 'direction_ambiguous',
            question: '突破上轨时是只做空还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      rejectReason: null,
    })

    const result = await service.getSession('s-snapshot', 'u1')

    expect(result.status).toBe('PUBLISHED')
    expect(result.strategyInstanceId).toBe('instance-snapshot-1')
    expect(result.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'rule.entry.upper_band.side_scope',
          status: 'pending',
        }),
      ],
    })
    expect(result.publishedSnapshotId).toBe('snapshot-session-1')
    expect(result.consistencyReport).toEqual({ status: 'PASSED' })
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

  it('keeps drafting in continueSession when planner returns logic that requires clarification', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4-clarify',
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
          entryRules: ['突破布林带上轨交易'],
          exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        },
      }),
    })

    const result = await service.continueSession('s4-clarify', {
      userId: 'u1',
      message: '就按这个逻辑推进',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'DRAFTING',
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
      }),
    }))
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'CHECKLIST_GATE',
    }))
  })

  it('publishes after confirmGenerate with planner+generator pipeline', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
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
        content: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = Array.isArray(ctx.bars) ? ctx.bars : []
    if (bars.length < 20) return { action: 'NOOP', reason: 'insufficient bars' }
    const closes = bars.map(item => item?.close).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (closes.length < 20) return { action: 'NOOP', reason: 'insufficient closes' }
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP', reason: 'sma unavailable' }
    if (fast > slow) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 }, confidence: 80, reason: 'golden cross' }
    if (fast < slow) return { action: 'CLOSE_LONG', reason: 'death cross' }
    return { action: 'NOOP', reason: 'wait' }
  },
}
strategy`,
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s5', expect.not.objectContaining({
      clarificationState: expect.anything(),
    }))
    await waitForTerminalStatus('s5')

    expect(mockRepo.createVersion).toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('marks consistency failed when script output cannot satisfy signal payload schema and fallback publish is disabled', async () => {
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
    await waitForTerminalStatus('s6')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && ['CONSISTENCY_FAILED', 'REJECTED'].includes((call[1] as { status?: string }).status ?? ''),
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
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
    await waitForTerminalStatus('s7')

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
    await waitForTerminalStatus('s8')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('provider timeout'),
    }))
  })

  it('marks session rejected instead of published when publish step fails after code generation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8-publish-fail',
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
      .mockResolvedValueOnce({
        content: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-publish-fail' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValue(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
    )

    const result = await service.continueSession('s8-publish-fail', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8-publish-fail')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8-publish-fail', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      rejectReason: expect.stringContaining('Unable to start a transaction'),
      strategyInstanceId: null,
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
    await waitForTerminalStatus('s9')

    expect(mockAi.chat).toHaveBeenCalledTimes(3)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s9', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const repairPrompt = (mockAi.chat.mock.calls[2]?.[0] as { messages: Array<{ role: string; content: string }> })?.messages?.[1]?.content
    expect(repairPrompt).toContain('自动修复')
  }, 15_000)

  it('returns consistency failed after exhausting auto-repair retries and blocks fallback publish', async () => {
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
    await waitForTerminalStatus('s10')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's10' && ['CONSISTENCY_FAILED', 'REJECTED'].includes((call[1] as { status?: string }).status ?? ''),
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's10' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
  }, 15_000)

  it('marks session as consistency failed when validated script does not match checklist semantics', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-consistency',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          earlyStop: '价格连续3根K线在轨外时考虑提前止损或减仓',
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
        content: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = Array.isArray(ctx.bars) ? ctx.bars : []
    if (bars.length < 20) return { action: 'NOOP', reason: 'fallback: insufficient bars' }
    const closes = bars.map(item => item?.close).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    const size: StrategyDecisionV1['size'] = { mode: 'RATIO', value: 0.1 }
    if (fast > slow) return { action: 'OPEN_LONG', size, confidence: 55, reason: 'fallback: fast SMA above slow SMA' }
    if (fast < slow) return { action: 'OPEN_SHORT', size, confidence: 55, reason: 'fallback: fast SMA below slow SMA' }
    return { action: 'NOOP', reason: 'fallback: neutral trend' }
  },
}
strategy`,
      })
      .mockResolvedValueOnce({
        content: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bars = Array.isArray(ctx.bars) ? ctx.bars : []
    if (bars.length < 20) return { action: 'NOOP', reason: 'fallback: insufficient bars' }
    const closes = bars.map(item => item?.close).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    const size: StrategyDecisionV1['size'] = { mode: 'RATIO', value: 0.1 }
    if (fast > slow) return { action: 'OPEN_LONG', size, confidence: 55, reason: 'fallback: fast SMA above slow SMA' }
    if (fast < slow) return { action: 'OPEN_SHORT', size, confidence: 55, reason: 'fallback: fast SMA below slow SMA' }
    return { action: 'NOOP', reason: 'fallback: neutral trend' }
  },
}
strategy`,
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-consistency' })

    const result = await service.continueSession('s-consistency', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-consistency')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && ['CONSISTENCY_FAILED', 'REJECTED'].includes((call[1] as { status?: string }).status ?? ''),
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
  }, 15_000)

  it('marks session consistency failed when canonical spec version is not 2', async () => {
    const buildSpy = jest.spyOn(canonicalSpecBuilder, 'build').mockReturnValue({
      version: 1,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '15m',
      },
      indicators: [],
      entries: [],
      exits: [],
      riskRules: [],
      sizing: {
        mode: 'RATIO',
        value: 0.1,
      },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {},
    } as never)

    mockRepo.findById.mockResolvedValue({
      id: 's-v1',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨时做空'],
        exitRules: ['价格回到布林带中轨时平仓'],
      },
      clarificationState: { status: 'CLEAR', items: [] },
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

    const result = await service.continueSession('s-v1', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-v1')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-v1', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      rejectReason: 'canonical_spec_v2_required_for_publication',
    }))
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith('s-v1', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    buildSpy.mockRestore()
  })

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
    await waitForTerminalStatus('s11')

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
    await waitForTerminalStatus('s12')

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
    await waitForTerminalStatus('s13')

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
    await waitForTerminalStatus('s14')

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
    await waitForTerminalStatus('s15')

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
    await waitForTerminalStatus('s16')

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
    await waitForTerminalStatus('s17')

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
    await waitForTerminalStatus('s18')

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
    await waitForTerminalStatus('s-new-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalledTimes(1)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 's-new-instance',
      strategyInstanceId: 'instance-1',
      scriptSnapshot: expect.any(String),
    }))
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
    await waitForTerminalStatus('s-perp-publish')

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
    await waitForTerminalStatus('s-existing-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-existing-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-existing',
    }))
  })

  it('rejects publish when strategy instance binding fails before snapshot creation', async () => {
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
    await waitForTerminalStatus('s-instance-failed')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-instance-failed', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      strategyInstanceId: null,
      rejectReason: 'create instance failed',
    }))
    expect(mockRepo.create).not.toHaveBeenCalled()
  })
})
