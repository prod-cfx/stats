import { describe, expect, it } from '@jest/globals'

import {
  AI_QUANT_PERSISTED_SCHEMA_VERSION,
  createConversationFromServerConversation,
  hasExplicitBacktestExecutionOverrides,
  hydrateConversation,
  hydrateConversations,
  invalidateConversationPublication,
  resolveBacktestExecutionConfig,
  serializePersistedConversations,
} from './ai-quant-page-conversation'

describe('ai-quant-page-conversation', () => {
  it('restores published script code from confirmed assistant code block during hydration', () => {
    const conversation = hydrateConversation({
      id: 'conv-1',
      title: 'test',
      messages: [
        { id: 'm-1', role: 'assistant', content: 'hello' },
        {
          id: 'm-2',
          role: 'assistant',
          content: 'generated\n```javascript\nreturn { ok: true }\n```',
        },
      ],
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      backtestResult: null,
      logicGraph: {
        version: 3,
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
      semanticGraph: null,
      validationReport: null,
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: 'snapshot-1',
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    })

    expect(conversation.publishedScriptCode).toBe('return { ok: true }')
    expect(conversation.publishedScriptGraphVersion).toBe(3)
  })

  it('resets transient backtest state and clears legacy implicit execution config during hydration', () => {
    const conversation = hydrateConversation({
      id: 'conv-1',
      title: 'test',
      messages: [],
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      backtestResult: null,
      logicGraph: null,
      semanticGraph: null,
      validationReport: null,
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionConfigExplicit: false,
      backtestExecutionState: 'running',
      updatedAt: 1,
    })

    expect(conversation.backtestExecutionState).toBe('idle')
    expect(conversation.backtestExecutionConfigExplicit).toBe(false)
    expect(conversation.paramValues.backtestInitialCash).toBeUndefined()
    expect(conversation.paramValues.backtestLeverage).toBeUndefined()
    expect(conversation.paramValues.backtestSlippageBps).toBeUndefined()
    expect(conversation.paramValues.backtestFeeBps).toBeUndefined()
    expect(conversation.paramValues.backtestPriceSource).toBeUndefined()
    expect(conversation.paramValues.backtestAllowPartial).toBeUndefined()
  })

  it('preserves snapshot-bound default backtest execution params during hydration for published snapshots', () => {
    const conversation = hydrateConversation({
      id: 'conv-published-defaults',
      title: 'published',
      messages: [],
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
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
      semanticGraph: null,
      validationReport: null,
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      publishedScriptCode: 'return { ok: true }',
      publishedScriptGraphVersion: 1,
      latestSignalMessage: null,
      backtestExecutionConfigExplicit: false,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    })

    expect(conversation.backtestExecutionConfigExplicit).toBe(false)
    expect(conversation.paramValues.backtestInitialCash).toBe(10000)
    expect(conversation.paramValues.backtestLeverage).toBe(1)
    expect(conversation.paramValues.backtestSlippageBps).toBe(10)
    expect(conversation.paramValues.backtestFeeBps).toBe(5)
    expect(conversation.paramValues.backtestPriceSource).toBe('close')
    expect(conversation.paramValues.backtestAllowPartial).toBe(true)
  })

  it('invalidates published artifacts and optionally marks the logic graph as draft', () => {
    const next = invalidateConversationPublication(
      {
        id: 'conv-1',
        title: 'test',
        messages: [],
        params: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          buyWindowMin: 3,
          buyDropPct: 1,
          sellWindowMin: 15,
          sellRisePct: 2,
          positionPct: 10,
        },
        paramSchema: null,
        paramValues: {},
        backtestResult: {
          id: 'bt-1',
          maxDrawdownPct: 5,
          totalReturnPct: 10,
          winRatePct: 60,
          tradeCount: 12,
        },
        logicGraph: {
          version: 2,
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
        semanticGraph: null,
        validationReport: null,
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        publishedScriptCode: 'return { ok: true }',
        publishedScriptGraphVersion: 2,
        latestSignalMessage: 'latest',
        backtestExecutionState: 'succeeded',
        updatedAt: 1,
      },
      { markGraphDraft: true },
    )

    expect(next.logicGraph?.status).toBe('draft')
    expect(next.publishedStrategyInstanceId).toBeNull()
    expect(next.publishedSnapshotId).toBeNull()
    expect(next.publishedScriptCode).toBeNull()
    expect(next.publishedScriptGraphVersion).toBeNull()
    expect(next.backtestResult).toBeNull()
    expect(next.latestSignalMessage).toBeNull()
    expect(next.backtestExecutionState).toBe('idle')
  })

  it('hydrates clarificationGate and publicationGate from stored conversation state', () => {
    const conversation = hydrateConversation({
      id: 'conv-1',
      title: 'test',
      messages: [],
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {},
      backtestResult: null,
      logicGraph: null,
      semanticGraph: null,
      validationReport: null,
      clarificationGate: {
        blocked: true,
        items: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '这条策略包含做空，请确认使用现货还是合约/永续？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
      publicationGate: {
        passed: false,
        blockingMismatches: [
          {
            field: 'exchange',
            expected: 'okx',
            actual: 'binance',
            reason: 'confirmed snapshot and compiled artifact exchange mismatch',
          },
        ],
      },
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    } as any)

    expect(conversation.clarificationGate?.blocked).toBe(true)
    expect(conversation.clarificationGate?.items[0]?.key).toBe('market.marketType')
    expect(conversation.publicationGate?.passed).toBe(false)
    expect(conversation.publicationGate?.blockingMismatches[0]?.actual).toBe('binance')
  })

  it('normalizes legacy clarificationGate.pendingItems into items during hydration', () => {
    const conversation = hydrateConversation({
      id: 'conv-legacy-gate',
      title: 'test',
      messages: [],
      params: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {},
      backtestResult: null,
      logicGraph: null,
      semanticGraph: null,
      validationReport: null,
      clarificationGate: {
        blocked: true,
        pendingItems: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '这条策略包含做空，请确认使用现货还是合约/永续？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
      publicationGate: null,
      llmCodegenSessionId: 'session-legacy',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    } as any)

    expect(conversation.clarificationGate?.blocked).toBe(true)
    expect(conversation.clarificationGate?.items[0]?.key).toBe('market.marketType')
  })

  it('clears stale confirmation artifacts when stored canonical digest disagrees with codegenSpecDesc', () => {
    const conversation = hydrateConversation({
      id: 'conv-stale-digest',
      title: 'test',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      backtestResult: null,
      logicGraph: {
        version: 4,
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
        canonicalDigest: 'sha256:canonical-2',
      },
      semanticGraph: {
        version: 1,
        market: {
          symbol: 'BTCUSDT',
          primaryTimeframe: '15m',
        },
        nodes: [],
        actions: [],
        risk: [],
      } as any,
      validationReport: {
        ok: true,
        errors: [],
      },
      clarificationGate: null,
      publicationGate: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
      llmCodegenSessionId: 'session-stale',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: 'snapshot-stale',
      publishedScriptCode: 'return { stale: true }',
      publishedScriptGraphVersion: 4,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    } as any)

    expect(conversation.codegenSpecDesc).toEqual({
      canonicalDigest: 'sha256:canonical-2',
    })
    expect(conversation.semanticGraph).toBeNull()
    expect(conversation.validationReport).toBeNull()
    expect(conversation.pendingCanonicalDigest).toBeNull()
    expect(conversation.llmCodegenSessionId).toBeNull()
    expect(conversation.publishedSnapshotId).toBeNull()
    expect(conversation.publishedScriptCode).toBeNull()
    expect(conversation.publishedScriptGraphVersion).toBeNull()
  })

  it('hydrates failed server conversations with a terminal failure summary and keeps the graph confirmed', () => {
    const conversation = createConversationFromServerConversation({
      id: 'server-conv-1',
      conversationTitle: '失败会话',
      conversationMessages: [
        { role: 'user', content: '用户消息' },
        { role: 'assistant', content: '请确认逻辑图' },
        { role: 'user', content: 'Confirm code generation' },
      ],
      status: 'CONSISTENCY_FAILED',
      canonicalDigest: 'sha256:canonical-1',
      rejectReason: '策略脚本与策略描述不一致：脚本缺少关键规则映射: bollinger.bars_outside:risk:both',
      publicationGate: { passed: true, blockingMismatches: [] },
      scriptCode: 'export default function strategy() { return true }',
      publishedSnapshotId: null,
      specDesc: {
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        rules: [],
      },
    } as any, (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key))

    expect(conversation.logicGraph?.status).toBe('confirmed')
    expect(conversation.messages.at(-1)?.content).toContain('CONSISTENCY_FAILED')
    expect(conversation.messages.at(-1)?.content).toContain('脚本已生成，但没有通过一致性校验')
    expect(conversation.messages.at(-1)?.content).toContain('脚本缺少关键规则映射')
    expect(conversation.messages.at(-1)?.content).toContain('规则解释：风控规则“价格连续若干根 K 线位于布林带外”没有在最终脚本里正确实现（同时作用于多头和空头）')
  })

  it('hydrates published server conversations with a generated code summary when history lacks it', () => {
    const conversation = createConversationFromServerConversation({
      id: 'server-conv-2',
      conversationTitle: '成功会话',
      conversationMessages: [
        { role: 'user', content: '用户消息' },
      ],
      status: 'PUBLISHED',
      canonicalDigest: 'sha256:canonical-2',
      scriptCode: 'export default function strategy() { return true }',
      publishedSnapshotId: 'snapshot-1',
      specDesc: {
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        rules: [],
      },
    } as any, (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key))

    expect(conversation.logicGraph?.status).toBe('confirmed')
    expect(conversation.messages.at(-1)?.content).toContain('Strategy code generated, ready to backtest.')
    expect(conversation.messages.at(-1)?.content).toContain('export default function strategy()')
  })

  it('keeps published snapshot default backtest params when persisting conversations for reload parity', () => {
    const serialized = serializePersistedConversations([
      {
        id: 'conv-persisted-published',
        title: 'persisted',
        messages: [],
        params: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          buyWindowMin: 3,
          buyDropPct: 1,
          sellWindowMin: 15,
          sellRisePct: 2,
          positionPct: 10,
        },
        paramSchema: null,
        paramValues: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          buyWindowMin: 3,
          buyDropPct: 1,
          sellWindowMin: 15,
          sellRisePct: 2,
          positionPct: 10,
          backtestInitialCash: 10000,
          backtestLeverage: 1,
          backtestSlippageBps: 10,
          backtestFeeBps: 5,
          backtestPriceSource: 'close',
          backtestAllowPartial: true,
        },
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
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        publishedScriptCode: 'return { ok: true }',
        publishedScriptGraphVersion: 1,
        latestSignalMessage: null,
        backtestExecutionConfigExplicit: false,
        backtestExecutionState: 'idle',
        updatedAt: 1,
        schemaVersion: AI_QUANT_PERSISTED_SCHEMA_VERSION,
      },
    ], 'deploy-2026-04-11')

    const envelope = JSON.parse(serialized)
    expect(envelope.conversations[0].paramValues.backtestInitialCash).toBe(10000)
    expect(envelope.conversations[0].paramValues.backtestLeverage).toBe(1)
    expect(envelope.conversations[0].paramValues.backtestSlippageBps).toBe(10)
    expect(envelope.conversations[0].paramValues.backtestFeeBps).toBe(5)
    expect(envelope.conversations[0].paramValues.backtestPriceSource).toBe('close')
    expect(envelope.conversations[0].paramValues.backtestAllowPartial).toBe(true)
  })

})
