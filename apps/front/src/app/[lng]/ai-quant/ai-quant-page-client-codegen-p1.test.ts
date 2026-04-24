import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ApiError } from '@/lib/errors'
import {
  applyCodegenResponseToConversationState,
  buildCodegenReplyContent,
  extractCodegenErrorMessage,
  requestAiQuantCodegen,
  resolvePublishedStrategyInstanceId,
} from './ai-quant-page-codegen'
import {
  createConversation,
  DEFAULT_PARAMS,
  DEFAULT_PARAM_SCHEMA,
  DEFAULT_PARAM_VALUES,
} from './ai-quant-page-conversation'

const mockContinueLlmCodegenSession = jest.fn()
const mockGetLlmCodegenSession = jest.fn()

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async <T>(task: () => Promise<T> | T) => await task(),
}))

jest.mock('lucide-react', () => {
  const Icon = () => null
  return new Proxy({}, { get: () => Icon })
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}))

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string, children: unknown }) => ({ href, children }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: { userId: 'u-1' },
    isLoading: false,
  }),
}))

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  upsertStrategyDeployment: jest.fn(),
}))

jest.mock('@/components/ai-quant/ConversationSidebar', () => ({
  ConversationSidebar: () => null,
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: () => null,
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => null,
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: () => null,
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: () => null,
}))

jest.mock('@/components/ai-quant/backtest-payload-builder', () => ({
  buildBacktestPayload: jest.fn(),
  isBacktestPayloadBuilderError: jest.fn(() => false),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: jest.fn(),
}))

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: jest.fn(),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: jest.fn(),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: (...args: unknown[]) => mockContinueLlmCodegenSession(...args),
  fetchUserExchangeAccountStatuses: jest.fn(),
  getLlmCodegenSession: (...args: unknown[]) => mockGetLlmCodegenSession(...args),
  startLlmCodegenSession: jest.fn(),
  updateAiQuantConversationBacktestDraft: jest.fn(async () => undefined),
}))

describe('AiQuantPageClient codegen P1 guards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears publishedStrategyInstanceId on fallback status or new session start', () => {
    const rejected = resolvePublishedStrategyInstanceId({
      response: {
        id: 's1',
        status: 'REJECTED',
        rejectReason: 'runtime error',
      },
      isStartingNewSession: false,
    })
    const newSessionStart = resolvePublishedStrategyInstanceId({
      response: {
        id: 's2',
        status: 'DRAFTING',
      },
      isStartingNewSession: true,
    })

    expect(rejected).toBeNull()
    expect(newSessionStart).toBeNull()
  })

  it('shows failure message when published carries rejectReason', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's3',
        status: 'PUBLISHED',
        rejectReason: 'create instance failed',
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      logicContinuedMessage: '继续检查',
      logicUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败')
    expect(content).toContain('create instance failed')
    expect(content).not.toBe('发布成功')
  })

  it('preserves structured codegen runtime metadata in displayed error text', () => {
    const message = extractCodegenErrorMessage(
      new ApiError('LLM 策略生成请求失败', 'LLM_CODEGEN_ERROR', 503, {
        error: {
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          stage: 'codegen',
          requestId: 'codegen-req-1',
          args: {
            reasonMessage: '量化服务暂时不可用，请稍后重试',
          },
        },
      }),
      '默认错误',
    )

    expect(message).toBe(
      '量化服务暂时不可用，请稍后重试 codegen (SERVICE_TEMPORARILY_UNAVAILABLE, HTTP 503, requestId codegen-req-1)',
    )
  })

  it('prefers rejectReason when publication gate blocks publish', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's4',
        status: 'REJECTED',
        rejectReason: 'positionMode mismatch',
        publicationGate: {
          passed: false,
          blockingMismatches: [
            {
              field: 'positionMode',
              expected: 'long_only',
              actual: 'long_short',
              reason: 'confirmed positionMode and compiled artifact mismatch',
            },
          ],
        },
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      logicContinuedMessage: '继续检查',
      logicUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败')
    expect(content).toContain('positionMode mismatch')
    expect(content).not.toBe('失败（无原因）')
  })

  it('formats consistency failures with stage, explanation, and backend reason', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's4b',
        status: 'CONSISTENCY_FAILED',
        rejectReason: '脚本缺少关键规则映射: bollinger.bars_outside:risk:both',
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      logicContinuedMessage: '继续检查',
      logicUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败（CONSISTENCY_FAILED）')
    expect(content).toContain('脚本已生成，但没有通过一致性校验')
    expect(content).toContain('后端返回：脚本缺少关键规则映射')
    expect(content).toContain('规则解释：风控规则“价格连续若干根 K 线位于布林带外”没有在最终脚本里正确实现（同时作用于多头和空头）')
  })

  it('reconciles only the active session before confirmGenerate and does not fan out to unrelated sessions', async () => {
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
    const secondaryConversation = {
      ...primaryConversation,
      id: 'conv-2',
      title: 'conv-2',
      llmCodegenSessionId: 'session-2',
      pendingCanonicalDigest: 'sha256:canonical-2',
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
      conversations: [primaryConversation, secondaryConversation] as any,
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

  it('writes serverConversationId from codegen responses without replacing the local temporary conversation id', () => {
    const next = applyCodegenResponseToConversationState({
      conversation: {
        id: 'conv-local-temp',
        serverConversationId: null,
        title: '新对话',
        messages: [{ id: 'm-1', role: 'assistant', content: 'hello' }],
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
      } as any,
      response: {
        id: 'session-1',
        conversationId: 'server-conv-1',
        status: 'DRAFTING',
        conversationTitle: '服务端会话',
        conversationMessages: [
          { role: 'user', content: 'test' },
          { role: 'assistant', content: 'reply' },
        ],
      } as any,
      confirmGenerate: false,
      targetParams: DEFAULT_PARAMS,
      backtestCapabilities: null,
      activeSessionId: 'session-1',
      trimmedMessage: 'test',
      t: (key: string) => key,
      loadingMessageId: null,
    })

    expect(next.id).toBe('conv-local-temp')
    expect(next.serverConversationId).toBe('server-conv-1')
  })

  it('appends rejectReason when terminal failure snapshot only returns historical conversationMessages', () => {
    const next = applyCodegenResponseToConversationState({
      conversation: {
        id: 'conv-local-temp',
        serverConversationId: 'server-conv-1',
        title: '新对话',
        messages: [{ id: 'loading', role: 'assistant', content: 'loading' }],
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
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      } as any,
      response: {
        id: 'session-1',
        conversationId: 'server-conv-1',
        status: 'CONSISTENCY_FAILED',
        rejectReason: '脚本缺少关键规则映射',
        conversationMessages: [
          { role: 'assistant', content: '请确认逻辑图' },
          { role: 'user', content: 'Confirm code generation' },
        ],
      } as any,
      confirmGenerate: true,
      targetParams: DEFAULT_PARAMS,
      backtestCapabilities: null,
      activeSessionId: 'session-1',
      trimmedMessage: 'Confirm code generation',
      t: (key: string, options?: Record<string, unknown>) =>
        options?.defaultValue ? String(options.defaultValue) : key,
      loadingMessageId: 'loading',
    })

    expect(next.messages).toHaveLength(3)
    expect(next.messages.at(-1)?.role).toBe('assistant')
    expect(next.messages.at(-1)?.content).toContain('脚本缺少关键规则映射')
  })

  it('appends generated code reply when published snapshot returns only historical conversationMessages', () => {
    const next = applyCodegenResponseToConversationState({
      conversation: {
        id: 'conv-local-temp',
        serverConversationId: 'server-conv-1',
        title: '新对话',
        messages: [{ id: 'loading', role: 'assistant', content: 'loading' }],
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
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      } as any,
      response: {
        id: 'session-1',
        conversationId: 'server-conv-1',
        status: 'PUBLISHED',
        scriptCode: 'export default function strategy() { return true }',
        publishedSnapshotId: 'snapshot-1',
        conversationMessages: [
          { role: 'assistant', content: '请确认逻辑图' },
          { role: 'user', content: 'Confirm code generation' },
        ],
      } as any,
      confirmGenerate: true,
      targetParams: DEFAULT_PARAMS,
      backtestCapabilities: null,
      activeSessionId: 'session-1',
      trimmedMessage: 'Confirm code generation',
      t: (key: string, options?: Record<string, unknown>) =>
        options?.defaultValue ? String(options.defaultValue) : key,
      loadingMessageId: 'loading',
    })

    expect(next.messages).toHaveLength(3)
    expect(next.messages.at(-1)?.content).toContain('Generated strategy code')
    expect(next.messages.at(-1)?.content).toContain('export default function strategy()')
  })

  it('hydrates published snapshot backtest params into the live conversation state', () => {
    const next = applyCodegenResponseToConversationState({
      conversation: {
        id: 'conv-live',
        serverConversationId: 'server-conv-1',
        title: '新对话',
        messages: [{ id: 'loading', role: 'assistant', content: 'loading' }],
        params: DEFAULT_PARAMS,
        paramSchema: DEFAULT_PARAM_SCHEMA,
        paramValues: {
          ...DEFAULT_PARAM_VALUES,
          backtestRangePreset: '90D',
        },
        backtestResult: null,
        logicGraph: null,
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionConfigExplicit: false,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      } as any,
      response: {
        id: 'session-1',
        conversationId: 'server-conv-1',
        status: 'PUBLISHED',
        scriptCode: 'export default function strategy() { return true }',
        publishedSnapshotId: 'snapshot-1',
        publishedSnapshotParamValues: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '1h',
          positionPct: 25,
          backtestInitialCash: 20000,
          backtestLeverage: 3,
          backtestSlippageBps: 6,
          backtestFeeBps: 2,
          backtestPriceSource: 'mid',
          backtestAllowPartial: false,
        },
      } as any,
      confirmGenerate: true,
      targetParams: DEFAULT_PARAMS,
      backtestCapabilities: null,
      activeSessionId: 'session-1',
      trimmedMessage: 'Confirm code generation',
      t: (key: string, options?: Record<string, unknown>) =>
        options?.defaultValue ? String(options.defaultValue) : key,
      loadingMessageId: 'loading',
    })

    expect(next.publishedSnapshotId).toBe('snapshot-1')
    expect(next.backtestExecutionConfigExplicit).toBe(true)
    expect(next.paramValues).toMatchObject({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '1h',
      positionPct: 25,
      backtestRangePreset: '90D',
      backtestInitialCash: 20000,
      backtestLeverage: 3,
      backtestSlippageBps: 6,
      backtestFeeBps: 2,
      backtestPriceSource: 'mid',
      backtestAllowPartial: false,
    })
    expect(next.params).toMatchObject({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '1h',
      positionPct: 25,
    })
  })

  it('prefers authoritative publishedSnapshotParamValues over strategyConfig-derived subsets on publish response', () => {
    const next = applyCodegenResponseToConversationState({
      conversation: {
        ...createConversation((key: string) => key),
        id: 'conv-2',
        title: 'test',
        paramSchema: DEFAULT_PARAM_SCHEMA,
        paramValues: {
          ...DEFAULT_PARAM_VALUES,
          backtestRangePreset: '30D',
        },
        backtestResult: null,
        logicGraph: null,
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: 'session-2',
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionConfigExplicit: false,
        backtestExecutionState: 'idle',
        updatedAt: 1,
      } as any,
      response: {
        id: 'session-2',
        conversationId: 'server-conv-2',
        status: 'PUBLISHED',
        scriptCode: 'export default function strategy() { return true }',
        publishedSnapshotId: 'snapshot-2',
        publishedSnapshotParamValues: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '1h',
          positionPct: 25,
          buyDropPct: 1.5,
        },
        publishedSnapshotStrategyConfig: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '1h',
          positionPct: 25,
        },
      } as any,
      confirmGenerate: true,
      targetParams: DEFAULT_PARAMS,
      backtestCapabilities: null,
      activeSessionId: 'session-2',
      trimmedMessage: 'Confirm code generation',
      t: (key: string, options?: Record<string, unknown>) =>
        options?.defaultValue ? String(options.defaultValue) : key,
      loadingMessageId: 'loading',
    })

    expect(next.publishedSnapshotParamValues).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '1h',
      positionPct: 25,
      buyDropPct: 1.5,
    })
  })
})
