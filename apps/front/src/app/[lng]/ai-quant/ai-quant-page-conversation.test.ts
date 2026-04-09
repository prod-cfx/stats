import { describe, expect, it } from '@jest/globals'

import {
  hydrateConversation,
  invalidateConversationPublication,
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
})
