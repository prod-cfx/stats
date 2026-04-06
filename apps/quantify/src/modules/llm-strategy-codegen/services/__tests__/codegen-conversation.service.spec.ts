import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'
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
  const mockCompiledPublicationGate = {
    publish: jest.fn(),
  }

  const service = new CodegenConversationService(
    mockAi as unknown as AiService,
    mockRepo as unknown as CodegenSessionsRepository,
    mockRepo as unknown as PublishedStrategySnapshotsRepository,
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    new SpecDescBuilderService(),
    new CanonicalSpecBuilderService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    mockRecommendation as unknown as RecommendationIndexService,
    mockCompiledPublicationGate as unknown as CompiledPublicationGateService,
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

  const createGraphSnapshot = (overrides?: {
    symbol?: string
    timeframe?: string
    exchange?: 'binance' | 'okx' | 'hyperliquid'
    positionPct?: number
    entryOperator?: string
    exitOperator?: string
  }) => {
    const symbol = overrides?.symbol ?? 'BTCUSDT'
    const timeframe = overrides?.timeframe ?? '1h'
    const exchange = overrides?.exchange ?? 'binance'
    const positionPct = overrides?.positionPct ?? 25

    return {
      version: 3,
      status: 'confirmed' as const,
      trigger: [
        {
          id: 'trigger-entry-1',
          phase: 'entry' as const,
          operator: overrides?.entryOperator ?? 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
        },
        {
          id: 'trigger-exit-1',
          phase: 'exit' as const,
          operator: overrides?.exitOperator ?? 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))',
        },
      ],
      actions: [
        { id: 'action-buy-1', action: 'BUY' as const, target: symbol, amount: `${positionPct}%` },
        { id: 'action-sell-1', action: 'SELL' as const, target: symbol, amount: `${positionPct}%` },
      ],
      risk: ['stopLossPct: STOP_LOSS_PCT(4)'],
      meta: {
        exchange,
        symbol,
        timeframe,
        positionPct,
        executionTags: [],
      },
    }
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
    mockCompiledPublicationGate.publish.mockResolvedValue({
      snapshotId: 'snapshot-compiled-1',
      consistencyReport: {
        status: 'PASSED',
      },
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
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot: expect.objectContaining({
        status: 'confirmed',
        trigger: expect.arrayContaining([expect.objectContaining({ phase: 'entry' })]),
      }),
    }))
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
      rejectReason: null,
    })

    const result = await service.getSession('s-snapshot', 'u1')

    expect(result.status).toBe('PUBLISHED')
    expect(result.strategyInstanceId).toBe('instance-snapshot-1')
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
      graphSnapshot: expect.objectContaining({
        status: 'confirmed',
        trigger: expect.arrayContaining([expect.objectContaining({ phase: 'entry' })]),
      }),
    }))
  })

  it('publishes after confirmGenerate with compiled pipeline', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot(),
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s5')

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.createVersion).toHaveBeenCalled()
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot: expect.objectContaining({
        status: 'confirmed',
      }),
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('compiles from stored graph snapshot when confirmGenerate is true', async () => {
    const graphSnapshot = createGraphSnapshot()

    mockRepo.findById.mockResolvedValue({
      id: 's-compile',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      },
      constraintPack: {},
      latestSpecDesc: {
        market: { symbols: ['BTCUSDT'], timeframes: ['1h'] },
      },
      graphSnapshot,
      strategyInstanceId: null,
      rejectReason: null,
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-compile-1' })

    const result = await service.continueSession('s-compile', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-compile')

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot,
    }))
  })

  it('rejects confirmGenerate when graph snapshot is missing', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-missing-graph',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      },
      constraintPack: {},
      graphSnapshot: null,
    })

    await expect(service.continueSession('s-missing-graph', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
    })).rejects.toMatchObject({
      message: 'codegen.graph_snapshot_missing',
    })

    expect(mockCompiledPublicationGate.publish).not.toHaveBeenCalled()
    expect(mockAi.chat).not.toHaveBeenCalled()
  })

  it('does not re-read checklist fields when compilation starts', async () => {
    const graphSnapshot = createGraphSnapshot()
    mockRepo.findById.mockResolvedValue({
      id: 's-ignore-checklist',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      },
      constraintPack: {},
      graphSnapshot,
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-ignore-checklist' })

    const result = await service.continueSession('s-ignore-checklist', {
      userId: 'u1',
      message: '确认',
      confirmGenerate: true,
      entryRules: ['这条规则必须被忽略'],
      exitRules: ['这条规则也必须被忽略'],
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-ignore-checklist')

    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-ignore-checklist', expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['短均线上穿长均线（金叉）入场'],
        exitRules: ['短均线下穿长均线（死叉）出场'],
      }),
    }))
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot,
    }))
  })

  it('rejects when compiled publication gate fails validation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's6',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot({
        entryOperator: 'LT(RSI(CLOSE,14),30)',
        exitOperator: 'GT(ATR(CLOSE,14),3)',
      }),
    })
    mockCompiledPublicationGate.publish.mockRejectedValueOnce(new Error('compiled manifest invalid'))
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

  it('compiles directly when confirmGenerate is true and checklist is complete even if session is drafting', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's7',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot(),
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
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot: expect.objectContaining({
        status: 'confirmed',
      }),
    }))
  })

  it('marks session rejected instead of published when publish step fails after compilation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8-publish-fail',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot(),
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

  it('does not invoke legacy codegen repair flow when graph snapshot is available', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's9',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['价格收盘确认突破阻力位入场'],
        exitRules: ['跌破最近支撑位出场'],
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot(),
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v4' })

    const result = await service.continueSession('s9', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s9')

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledTimes(1)
  })

  it('ignores strict response_format settings when compiled graph snapshot is available', async () => {
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
      graphSnapshot: createGraphSnapshot(),
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

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      graphSnapshot: expect.objectContaining({
        status: 'confirmed',
      }),
    }))
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
      graphSnapshot: createGraphSnapshot({ timeframe: '5m' }),
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
    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 's-new-instance',
      strategyInstanceId: 'instance-1',
      graphSnapshot: expect.objectContaining({
        meta: expect.objectContaining({
          timeframe: '5m',
        }),
      }),
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-new-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-1',
    }))
  })

  it('persists user/strategy/script summaries and lockedParams on successful publish', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-summary-snapshot',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
        },
      },
      constraintPack: {},
      graphSnapshot: createGraphSnapshot({
        exchange: 'okx',
        timeframe: '15m',
        positionPct: 10,
      }),
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-summary-snapshot' })

    const result = await service.continueSession('s-summary-snapshot', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-summary-snapshot')

    expect(mockCompiledPublicationGate.publish).toHaveBeenCalledWith(expect.objectContaining({
      userIntentSummary: expect.any(Object),
      strategySummary: expect.any(Object),
      scriptSummary: expect.any(Object),
      lockedParams: expect.objectContaining({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
      }),
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
      graphSnapshot: createGraphSnapshot({
        timeframe: '15m',
        positionPct: 10,
      }),
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
      graphSnapshot: createGraphSnapshot({
        timeframe: '15m',
      }),
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
      graphSnapshot: createGraphSnapshot({
        timeframe: '5m',
      }),
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
    expect(mockCompiledPublicationGate.publish).not.toHaveBeenCalled()
  })
})
