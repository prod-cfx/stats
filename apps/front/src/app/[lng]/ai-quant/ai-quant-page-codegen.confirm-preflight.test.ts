/** @jest-environment jsdom */

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { requestAiQuantCodegen } from './ai-quant-page-codegen'
import {
  DEFAULT_PARAMS,
  DEFAULT_PARAM_SCHEMA,
  DEFAULT_PARAM_VALUES,
} from './ai-quant-page-conversation'

const mockContinueLlmCodegenSession = jest.fn()
const mockGetLlmCodegenSession = jest.fn()
const mockStartLlmCodegenSession = jest.fn()

jest.mock('@/lib/api', () => ({
  continueLlmCodegenSession: (...args: unknown[]) => mockContinueLlmCodegenSession(...args),
  getLlmCodegenSession: (...args: unknown[]) => mockGetLlmCodegenSession(...args),
  startLlmCodegenSession: (...args: unknown[]) => mockStartLlmCodegenSession(...args),
}))

describe('ai-quant-page-codegen confirm preflight reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('starts a new session with semantic-only payload', async () => {
    mockStartLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-new',
      status: 'DRAFTING',
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      conversationId: 'conv-1',
      conversations: [{
        id: 'conv-1',
        title: 'conv-1',
        messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
        params: DEFAULT_PARAMS,
        paramSchema: DEFAULT_PARAM_SCHEMA,
        paramValues: DEFAULT_PARAM_VALUES,
        backtestResult: null,
        logicGraph: null,
        codegenSpecDesc: {
          canonicalDigest: 'sha256:canonical-1',
          rules: [
            { phase: 'entry', condition: { key: 'bollinger.upper_break' } },
          ],
          market: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
          },
          lockedParams: {
            positionPct: 10,
          },
        },
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: 'sha256:canonical-1',
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      }] as any,
      message: '帮我生成一版布林带策略',
      params: DEFAULT_PARAMS,
      sessionId: null,
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockStartLlmCodegenSession).toHaveBeenCalledWith({
      initialMessage: '帮我生成一版布林带策略',
    })
    const payload = mockStartLlmCodegenSession.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('symbols')
    expect(payload).not.toHaveProperty('timeframes')
    expect(payload).not.toHaveProperty('entryRules')
    expect(payload).not.toHaveProperty('exitRules')
    expect(payload).not.toHaveProperty('riskRules')
  })

  it('blocks local request submission when semantic-era params are invalid', async () => {
    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      conversationId: 'conv-1',
      conversations: [{
        id: 'conv-1',
        title: 'conv-1',
        messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
        params: DEFAULT_PARAMS,
        paramSchema: DEFAULT_PARAM_SCHEMA,
        paramValues: DEFAULT_PARAM_VALUES,
        backtestResult: null,
        logicGraph: null,
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      }] as any,
      message: '帮我生成策略',
      params: {
        ...DEFAULT_PARAMS,
        symbol: '   ',
      },
      sessionId: null,
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockStartLlmCodegenSession).not.toHaveBeenCalled()
    expect(mockContinueLlmCodegenSession).not.toHaveBeenCalled()
    expect(mockGetLlmCodegenSession).not.toHaveBeenCalled()
  })

  it('injects structured preset context when usePresetRules starts generation', async () => {
    mockStartLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-preset',
      status: 'DRAFTING',
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      conversationId: 'conv-1',
      conversations: [{
        id: 'conv-1',
        title: 'conv-1',
        messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
        params: DEFAULT_PARAMS,
        paramSchema: DEFAULT_PARAM_SCHEMA,
        paramValues: DEFAULT_PARAM_VALUES,
        backtestResult: null,
        logicGraph: null,
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      }] as any,
      message: '网格策略模板, generate logic graph',
      params: {
        ...DEFAULT_PARAMS,
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      sessionId: null,
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
      usePresetRules: true,
    })

    expect(mockStartLlmCodegenSession).toHaveBeenCalledTimes(1)
    expect(mockStartLlmCodegenSession).toHaveBeenCalledWith(expect.objectContaining({
      initialMessage: expect.stringContaining('exchange=okx'),
    }))
    const payload = mockStartLlmCodegenSession.mock.calls.at(-1)?.[0] as { initialMessage?: string }
    expect(payload.initialMessage).toContain('symbol=ETHUSDT')
    expect(payload.initialMessage).toContain('timeframe=1h')
    expect(payload.initialMessage).toContain('positionPct=25')
    expect(payload.initialMessage).toContain('网格策略模板, generate logic graph')
  })

  it('continues the active session after a terminal preflight reconciliation fetch', async () => {
    const primaryConversation = {
      id: 'conv-1',
      title: 'conv-1',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: DEFAULT_PARAMS,
      paramSchema: DEFAULT_PARAM_SCHEMA,
      paramValues: DEFAULT_PARAM_VALUES,
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'confirmed',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      codegenSpecDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
      semanticGraph: null,
      validationReport: null,
      clarificationGate: null,
      publicationGate: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    }

    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: null,
      validationReport: null,
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
    })
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: null,
      validationReport: null,
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
      conversationId: 'conv-1',
      conversations: [primaryConversation] as any,
      message: '确认',
      params: DEFAULT_PARAMS,
      sessionId: 'session-1',
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockGetLlmCodegenSession.mock.calls).toEqual([['session-1']])
    expect(mockContinueLlmCodegenSession).toHaveBeenCalled()
  })

  it('does not resend checklist payload when confirmGenerate continues an existing session', async () => {
    const primaryConversation = {
      id: 'conv-1',
      title: 'conv-1',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: DEFAULT_PARAMS,
      paramSchema: DEFAULT_PARAM_SCHEMA,
      paramValues: DEFAULT_PARAM_VALUES,
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'confirmed',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      codegenSpecDesc: {
        canonicalDigest: 'sha256:canonical-1',
        rules: [
          {
            phase: 'entry',
            condition: { key: 'bollinger.upper_break' },
            actions: [{ type: 'OPEN_SHORT' }],
          },
        ],
      },
      semanticGraph: null,
      validationReport: null,
      clarificationGate: null,
      publicationGate: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    }

    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'CONFIRM_GATE',
      canonicalDigest: 'sha256:canonical-1',
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
    })
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'GENERATING',
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
      conversationId: 'conv-1',
      conversations: [primaryConversation] as any,
      message: 'Confirm code generation',
      params: DEFAULT_PARAMS,
      sessionId: 'session-1',
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith('session-1', {
      message: 'Confirm code generation',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
      clarificationAnswers: undefined,
    })
    const confirmPayload = mockContinueLlmCodegenSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(confirmPayload).not.toHaveProperty('symbols')
    expect(confirmPayload).not.toHaveProperty('timeframes')
    expect(confirmPayload).not.toHaveProperty('entryRules')
    expect(confirmPayload).not.toHaveProperty('exitRules')
    expect(confirmPayload).not.toHaveProperty('riskRules')
  })

  it('does not resend checklist payload when a normal continue uses an existing session', async () => {
    const primaryConversation = {
      id: 'conv-1',
      title: 'conv-1',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: DEFAULT_PARAMS,
      paramSchema: DEFAULT_PARAM_SCHEMA,
      paramValues: DEFAULT_PARAM_VALUES,
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'draft',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      codegenSpecDesc: {
        canonicalDigest: 'sha256:canonical-2',
        rules: [
          {
            phase: 'entry',
            condition: { key: 'bollinger.upper_break' },
            actions: [{ type: 'OPEN_SHORT' }],
          },
        ],
      },
      semanticGraph: null,
      validationReport: null,
      clarificationGate: null,
      publicationGate: null,
      pendingCanonicalDigest: 'sha256:canonical-2',
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    }

    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'DRAFTING',
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      confirmGenerate: false,
      confirmedCanonicalDigest: undefined,
      conversationId: 'conv-1',
      conversations: [primaryConversation] as any,
      message: '继续完善策略',
      params: DEFAULT_PARAMS,
      sessionId: 'session-1',
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith('session-1', {
      message: '继续完善策略',
      confirmGenerate: false,
      confirmedCanonicalDigest: undefined,
      clarificationAnswers: undefined,
    })
    const continuePayload = mockContinueLlmCodegenSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(continuePayload).not.toHaveProperty('symbols')
    expect(continuePayload).not.toHaveProperty('timeframes')
    expect(continuePayload).not.toHaveProperty('entryRules')
    expect(continuePayload).not.toHaveProperty('exitRules')
    expect(continuePayload).not.toHaveProperty('riskRules')
  })

})
