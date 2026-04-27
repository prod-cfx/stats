import type { AiQuantConversationSnapshotRecord } from '../../repositories/ai-quant-conversations.repository'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { AiService } from '@/modules/ai/ai.service'
import { ErrorCode } from '@ai/shared'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from '../strategy-compileability-decision.service'

describe('codegenConversationService edit recovery', () => {
  const recoveryMessage = '已基于上一版策略恢复修改上下文。你可以直接说明要调整的触发、行动、风控、仓位或运行参数。'

  const buildConversation = (
    overrides: Partial<AiQuantConversationSnapshotRecord> = {},
  ): AiQuantConversationSnapshotRecord => ({
    id: 'conversation-1',
    userId: 'user-1',
    codegenSessionId: 'session-1',
    title: 'BTC strategy',
    archivedAt: null,
    createdAt: new Date('2026-04-26T01:00:00.000Z'),
    updatedAt: new Date('2026-04-26T01:05:00.000Z'),
    backtestDraftConfig: null,
    lastBacktestRef: null,
    messages: [
      { role: 'user', content: '做一个 BTC 策略' },
      { role: 'assistant', content: '已整理策略逻辑。' },
    ],
    ...overrides,
  })

  const buildSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    userId: 'user-1',
    status: 'DRAFTING',
    semanticState: null,
    clarificationState: null,
    constraintPack: {
      conversationHistory: [
        'U: 做一个 BTC 策略',
        'A: 已整理策略逻辑。',
      ],
    },
    latestDraftCode: null,
    latestSpecDesc: { version: 1, source: 'existing' },
    semanticGraph: { version: 1, source: 'existing-graph' },
    validationReport: null,
    compiledIr: null,
    rejectReason: null,
    createdAt: new Date('2026-04-26T01:00:00.000Z'),
    updatedAt: new Date('2026-04-26T01:05:00.000Z'),
    strategyInstanceId: 'strategy-1',
    ...overrides,
  })

  const snapshotSemanticGraph = {
    version: 1,
    market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
    nodes: [
      {
        id: 'entry-drop-1',
        phase: 'entry',
        kind: 'price_change_pct',
        params: {
          timeframe: '15m',
          left: { source: 'close', offsetBars: 0 },
          right: { source: 'close', offsetBars: 1 },
          op: 'lte',
          valuePct: -1,
        },
      },
    ],
    actions: [{ id: 'open-long', kind: 'OPEN_LONG', sizePct: 25 }],
    risk: [],
  }

  const buildSnapshot = (overrides: Record<string, unknown> = {}) => ({
    id: 'snapshot-1',
    sessionId: 'published-session-1',
    strategyTemplateId: null,
    strategyInstanceId: 'strategy-1',
    specSnapshot: { market: { symbol: 'BTCUSDT' } },
    semanticGraph: null,
    paramsSnapshot: null,
    strategyConfig: {
      provider: 'okx',
      exchangeId: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      baseTimeframe: '15m',
      positionSizeRatioPercent: 25,
    },
    backtestConfigDefaults: { initialCash: 10000 },
    deploymentExecutionDefaults: { leverage: 2 },
    deploymentExecutionConstraints: { supportedOrderTypes: ['market'] },
    lockedParams: {},
    executionPolicy: { signalTiming: 'BAR_CLOSE' },
    originalSessionSemanticState: null,
    originalSessionLatestSpecDesc: null,
    createdAt: new Date('2026-04-26T00:00:00.000Z'),
    ...overrides,
  })

  const createHarness = () => {
    const sessions = new Map<string, Record<string, unknown>>()
    const sessionsRepo = {
      createSession: jest.fn(async (data: Record<string, unknown>) => {
        const session = {
          id: 'recovered-session-1',
          userId: data.userId,
          status: data.status,
          semanticState: data.semanticState,
          clarificationState: data.clarificationState ?? null,
          constraintPack: data.constraintPack,
          latestDraftCode: data.latestDraftCode ?? null,
          latestSpecDesc: data.latestSpecDesc ?? null,
          semanticGraph: data.semanticGraph ?? null,
          validationReport: null,
          compiledIr: null,
          rejectReason: data.rejectReason ?? null,
          createdAt: new Date('2026-04-26T02:00:00.000Z'),
          updatedAt: new Date('2026-04-26T02:00:00.000Z'),
          strategyInstanceId: data.strategyInstanceId ?? null,
        }
        sessions.set(session.id, session)
        return session
      }),
      findById: jest.fn(async (id: string) => sessions.get(id) ?? null),
    }
    const conversationsRepo = {
      findActiveByIdAndUser: jest.fn(),
      findActiveByAnyCodegenSessionIdAndUser: jest.fn(),
      listByUser: jest.fn().mockResolvedValue([]),
      upsertConversationSnapshot: jest.fn(async (input: {
        userId: string
        codegenSessionId: string
        title: string
        messages: AiQuantConversationSnapshotRecord['messages']
      }) => buildConversation({
        id: 'recovered-conversation-1',
        userId: input.userId,
        codegenSessionId: input.codegenSessionId,
        title: input.title,
        messages: input.messages,
        createdAt: new Date('2026-04-26T02:00:00.000Z'),
        updatedAt: new Date('2026-04-26T02:00:00.000Z'),
      })),
    }
    const publishedSnapshotsRepo = {
      findLatestBySessionId: jest.fn().mockResolvedValue(null),
      findEditableSnapshotForUser: jest.fn(),
    }
    const service = new CodegenConversationService(
      { chat: jest.fn() } as unknown as AiService,
      sessionsRepo as unknown as CodegenSessionsRepository,
      publishedSnapshotsRepo as unknown as PublishedStrategySnapshotsRepository,
      conversationsRepo as never,
      {} as never,
      {} as never,
      new SpecDescBuilderService(),
      new CanonicalSpecBuilderService(),
      new StrategyCompileabilityDecisionService(),
      new StrategyClarificationRulesService(),
      new StrategyClarificationQuestionService(),
      {} as never,
    )

    return {
      service,
      sessions,
      sessionsRepo,
      conversationsRepo,
      publishedSnapshotsRepo,
    }
  }

  it('returns an existing active conversation by conversationId and preserves its messages', async () => {
    const harness = createHarness()
    const conversation = buildConversation()
    harness.sessions.set('session-1', buildSession())
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(conversation)

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      conversationId: ' conversation-1 ',
    })

    expect(harness.conversationsRepo.findActiveByIdAndUser).toHaveBeenCalledWith('conversation-1', 'user-1')
    expect(result.id).toBe('conversation-1')
    expect(result.conversationMessages).toEqual(conversation.messages)
  })

  it('returns an existing active conversation by sessionId using the any-session helper', async () => {
    const harness = createHarness()
    const conversation = buildConversation({ codegenSessionId: 'session-2' })
    harness.sessions.set('session-2', buildSession({ id: 'session-2' }))
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(conversation)

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      sessionId: ' session-2 ',
    })

    expect(harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser).toHaveBeenCalledWith(['session-2'], 'user-1')
    expect(result.id).toBe('conversation-1')
    expect(result.conversationMessages).toEqual(conversation.messages)
  })

  it('recovers from a published snapshot into a new editable conversation with spec and semantic graph', async () => {
    const harness = createHarness()
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot({
      semanticGraph: snapshotSemanticGraph,
    }))

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      source: 'backtest',
    })

    expect(harness.publishedSnapshotsRepo.findEditableSnapshotForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
    })
    expect(harness.sessionsRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      status: 'DRAFTING',
      latestDraftCode: null,
      strategyInstanceId: 'strategy-1',
    }))
    expect(harness.conversationsRepo.upsertConversationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      title: '修改 BTCUSDT 策略',
      messages: [{ role: 'assistant', content: recoveryMessage }],
    }))
    expect(result.id).toBe('recovered-conversation-1')
    expect(result.specDesc).toBeTruthy()
    expect(result.semanticGraph).toEqual(snapshotSemanticGraph)
    expect(harness.sessionsRepo.createSession.mock.calls[0][0].semanticGraph).toEqual(snapshotSemanticGraph)
    expect(result.conversationMessages).toEqual([{ role: 'assistant', content: recoveryMessage }])
  })

  it('synthesizes a graph-shaped semantic graph when the snapshot has no semantic graph', async () => {
    const harness = createHarness()
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot())

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
    })

    expect(result.semanticGraph).toEqual({
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
      nodes: [],
      actions: [],
      risk: [],
    })
    expect(harness.sessionsRepo.createSession.mock.calls[0][0].semanticGraph).toEqual(result.semanticGraph)
  })

  it('throws edit_context_not_found when no editable snapshot exists', async () => {
    const harness = createHarness()
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(null)

    await expect(harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-missing',
    })).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      response: expect.objectContaining({
        message: 'ai_quant.edit_context_not_found',
      }),
    })
  })

  it('builds recovered semantics from atomic context and position fields without script or checklist parsing', async () => {
    const harness = createHarness()
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot({
      scriptSnapshot: 'return { positionSizeRatio: 0.99 }',
      specSnapshot: {
        checklist: {
          symbol: 'ETHUSDT',
          timeframe: '1h',
          positionPct: 99,
        },
      },
    }))

    await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
    })

    const createInput = harness.sessionsRepo.createSession.mock.calls[0][0]
    expect(createInput.semanticState).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: expect.objectContaining({ value: 'okx' }),
        symbol: expect.objectContaining({ value: 'BTCUSDT' }),
        marketType: expect.objectContaining({ value: 'perp' }),
        timeframe: expect.objectContaining({ value: '15m' }),
      }),
      position: expect.objectContaining({
        mode: 'fixed_ratio',
        value: 0.25,
      }),
    }))
  })

  it('falls through conversationId recovery when the existing conversation is terminal', async () => {
    const harness = createHarness()
    harness.sessions.set('published-session-1', buildSession({
      id: 'published-session-1',
      status: 'PUBLISHED',
    }))
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(buildConversation({
      id: 'published-conversation-1',
      codegenSessionId: 'published-session-1',
    }))
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot())

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      conversationId: 'published-conversation-1',
    })

    expect(result.id).toBe('recovered-conversation-1')
    expect(result.activeCodegenSessionId).toBe('recovered-session-1')
  })

  it('falls through sessionId recovery when the existing conversation is terminal', async () => {
    const harness = createHarness()
    harness.sessions.set('published-session-1', buildSession({
      id: 'published-session-1',
      status: 'PUBLISHED',
    }))
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(buildConversation({
      id: 'published-conversation-1',
      codegenSessionId: 'published-session-1',
    }))
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot())

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      sessionId: 'published-session-1',
    })

    expect(result.id).toBe('recovered-conversation-1')
    expect(result.activeCodegenSessionId).toBe('recovered-session-1')
  })

  it('does not reuse a same-strategy stale draft when an exact published snapshot id is requested', async () => {
    const harness = createHarness()
    harness.sessions.set('stale-session-1', buildSession({
      id: 'stale-session-1',
      strategyInstanceId: 'strategy-1',
    }))
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.listByUser.mockResolvedValue([
      buildConversation({
        id: 'stale-conversation-1',
        codegenSessionId: 'stale-session-1',
      }),
    ])
    harness.publishedSnapshotsRepo.findEditableSnapshotForUser.mockResolvedValue(buildSnapshot({
      id: 'snapshot-requested',
    }))

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-requested',
    })

    expect(result.id).toBe('recovered-conversation-1')
    expect(harness.publishedSnapshotsRepo.findEditableSnapshotForUser).toHaveBeenCalled()
  })

  it('scans active user conversations beyond the first fifty for strategy recovery', async () => {
    const harness = createHarness()
    const conversations = Array.from({ length: 51 }, (_, index) => buildConversation({
      id: `conversation-${index + 1}`,
      codegenSessionId: `session-${index + 1}`,
    }))
    conversations.forEach((conversation, index) => {
      harness.sessions.set(conversation.codegenSessionId, buildSession({
        id: conversation.codegenSessionId,
        strategyInstanceId: index === 50 ? 'strategy-1' : `other-strategy-${index + 1}`,
      }))
    })
    harness.conversationsRepo.findActiveByIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser.mockResolvedValue(null)
    harness.conversationsRepo.listByUser.mockResolvedValue(conversations)

    const result = await harness.service.recoverEditConversation('user-1', {
      strategyInstanceId: 'strategy-1',
    })

    expect(result.id).toBe('conversation-51')
    expect(harness.publishedSnapshotsRepo.findEditableSnapshotForUser).not.toHaveBeenCalled()
  })
})
