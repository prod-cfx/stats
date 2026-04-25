import { describe, expect, it } from '@jest/globals'

import {
  AI_QUANT_PERSISTED_SCHEMA_VERSION,
  buildBacktestSummaryResult,
  createConversationFromServerConversation,
  hasExplicitBacktestExecutionOverrides,
  hydrateConversation,
  hydrateConversations,
  invalidateConversationPublication,
  isDeployableBacktestResult,
  readPersistedConversations,
  requiresRepublishForPublishedSnapshot,
  resolveEffectivePublishedBacktestInputs,
  resolveBacktestExecutionConfig,
  serializePersistedConversations,
} from './ai-quant-page-conversation'

describe('ai-quant-page-conversation', () => {
  it('requires at least one trade before a backtest result is considered deployable', () => {
    expect(isDeployableBacktestResult(null)).toBe(false)
    expect(isDeployableBacktestResult({
      id: 'bt-0',
      maxDrawdownPct: 0,
      totalReturnPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    })).toBe(false)
    expect(isDeployableBacktestResult({
      id: 'bt-1',
      maxDrawdownPct: 20,
      totalReturnPct: 8,
      winRatePct: 55,
      tradeCount: 3,
    })).toBe(true)
    expect(isDeployableBacktestResult({
      id: 'bt-open-1',
      maxDrawdownPct: 20,
      totalReturnPct: 0,
      winRatePct: 0,
      tradeCount: 0,
      openTradeCount: 1,
    })).toBe(true)
    expect(isDeployableBacktestResult({
      id: 'bt-2',
      maxDrawdownPct: 20.01,
      totalReturnPct: 8,
      winRatePct: 55,
      tradeCount: 3,
    })).toBe(false)
    expect(isDeployableBacktestResult({
      id: 'bt-open-2',
      maxDrawdownPct: 20.01,
      totalReturnPct: 0,
      winRatePct: 0,
      tradeCount: 0,
      openTradeCount: 1,
    })).toBe(false)
  })

  it('preserves open-trade summary fields when building a backtest summary result', () => {
    expect(buildBacktestSummaryResult({
      id: 'bt-open-only',
      maxDrawdownPct: 0,
      totalReturnPct: 0,
      winRatePct: 0,
      tradeCount: 0,
      marketType: 'spot',
    }, {
      netProfitPct: 0,
      maxDrawdownPct: 0.3199,
      winRate: 0,
      totalTrades: 0,
      totalOpenTrades: 1,
      openPnl: 0.282686611713497,
    })).toMatchObject({
      id: 'bt-open-only',
      marketType: 'spot',
      tradeCount: 0,
      openTradeCount: 1,
      openPnl: 0.28,
    })
  })

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

  it('builds a display graph from server specDesc while keeping publication graph truth on logicGraph', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-remote-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      specDesc: {
        rules: [
          {
            id: 'entry-1',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
              params: {
                timeframe: '3m',
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
      semanticGraph: {
        version: 7,
        market: {
          symbol: 'BTCUSDT',
          primaryTimeframe: '15m',
        },
        nodes: [],
        actions: [],
        risk: [],
      },
      validationReport: null,
      publicationGate: null,
      canonicalDigest: 'sha256:canonical-1',
      activeCodegenSessionId: 'session-1',
      strategyInstanceId: null,
      publishedSnapshotId: null,
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: null,
      publishedSnapshotBacktestConfigDefaults: null,
      publishedSnapshotDeploymentExecutionDefaults: null,
      publishedSnapshotDeploymentExecutionConstraints: null,
      publishedSnapshotCompatibilityMetadata: null,
      scriptCode: 'return { ok: true }',
      updatedAt: '2026-04-17T00:00:00.000Z',
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.displayLogicGraph).not.toBeNull()
    expect(conversation.displayLogicGraph?.blocks[0]?.items.map(item => item.text).join(' ')).toContain('3m 内相对前收盘下跌 1%')
    expect(conversation.displayLogicGraph?.blocks.at(-1)?.items.map(item => item.text).join(' ')).toContain('BTCUSDT')
    expect(conversation.publishedScriptGraphVersion).toBe(conversation.logicGraph?.version)
    expect(conversation.logicGraph?.status).toBe('confirmed')
  })

  it('restores backtest summary from lastBacktestRef when publishedSnapshotId matches', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: true,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toEqual(expect.objectContaining({
      id: 'btjob-1',
      maxDrawdownPct: 8,
      totalReturnPct: 12,
      winRatePct: 60,
      tradeCount: 5,
      marketType: 'spot',
    }))
    expect(conversation.paramValues).toEqual(expect.objectContaining({
      backtestInitialCash: 10000,
      backtestLeverage: 1,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    }))
  })

  it('restores lastBacktestRef when snapshot and allowPartial=false execution config still match', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: false,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-allow-partial-false',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
        summary: {
          maxDrawdownPct: 7,
          totalReturnPct: 11,
          winRatePct: 58,
          tradeCount: 4,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toEqual(expect.objectContaining({
      id: 'btjob-allow-partial-false',
      maxDrawdownPct: 7,
      totalReturnPct: 11,
      winRatePct: 58,
      tradeCount: 4,
      marketType: 'spot',
    }))
  })

  it('restores backtest summary using normalized snapshot id and snapshot-owned symbol truth', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: ' snapshot-1 ',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: true,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-2',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: {
          maxDrawdownPct: 6,
          totalReturnPct: 18,
          winRatePct: 62,
          tradeCount: 7,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T00:05:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.publishedSnapshotId).toBe('snapshot-1')
    expect(conversation.backtestResult).toEqual(expect.objectContaining({
      id: 'btjob-2',
      symbol: 'ETHUSDT',
      maxDrawdownPct: 6,
      totalReturnPct: 18,
      winRatePct: 62,
      tradeCount: 7,
      marketType: 'spot',
    }))
  })

  it('does not restore lastBacktestRef when publishedSnapshotId has drifted', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-2',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: true,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toBeNull()
  })

  it('does not restore lastBacktestRef when raw backtest range input has drifted under the same snapshot', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: true,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-range-drift',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '7D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toBeNull()
  })

  it('does not restore lastBacktestRef when execution config has drifted under the same snapshot', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      backtestDraftConfig: {
        range: {
          preset: '30D',
        },
        execution: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: true,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-execution-drift',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 20000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toBeNull()
  })

  it('restores backtest summary using explicit backtestDraftConfig without relying on implicit range defaults', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-draft-1',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-7d',
      publishedSnapshotParamValues: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        positionPct: 10,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      backtestDraftConfig: {
        range: {
          preset: '7D',
        },
        execution: {
          initialCash: 10000,
          leverage: null,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: false,
        },
      },
      lastBacktestRef: {
        jobId: 'btjob-7d',
        publishedSnapshotId: 'snapshot-7d',
        config: {
          range: {
            preset: '7D',
          },
          execution: {
            initialCash: 10000,
            leverage: null,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
        summary: {
          maxDrawdownPct: 0.02,
          totalReturnPct: 0.03,
          winRatePct: 100,
          tradeCount: 1,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T10:40:43.354Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toEqual(expect.objectContaining({
      id: 'btjob-7d',
      symbol: 'DOGEUSDT',
      maxDrawdownPct: 0.02,
      totalReturnPct: 0.03,
      winRatePct: 100,
      tradeCount: 1,
      marketType: 'spot',
    }))
    expect(conversation.paramValues).toEqual(expect.objectContaining({
      backtestRangePreset: '7D',
      backtestInitialCash: 10000,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: false,
    }))
  })

  it('does not restore lastBacktestRef when explicit backtestDraftConfig is missing', () => {
    const conversation = createConversationFromServerConversation({
      id: 'conv-draft-missing',
      conversationTitle: 'remote',
      status: 'PUBLISHED',
      conversationMessages: [],
      publishedSnapshotId: 'snapshot-7d',
      publishedSnapshotParamValues: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        positionPct: 10,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      lastBacktestRef: {
        jobId: 'btjob-7d',
        publishedSnapshotId: 'snapshot-7d',
        config: {
          range: {
            preset: '7D',
          },
          execution: {
            initialCash: 10000,
            leverage: null,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
        summary: {
          maxDrawdownPct: 0.02,
          totalReturnPct: 0.03,
          winRatePct: 100,
          tradeCount: 1,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T10:40:43.354Z',
      },
    } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

    expect(conversation.backtestResult).toBeNull()
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

  it('hydrates older persisted conversations without display graphs safely', () => {
    const conversation = hydrateConversation({
      id: 'conv-legacy',
      title: 'legacy',
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
      },
      backtestResult: null,
      logicGraph: null,
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
    })

    expect(conversation.displayLogicGraph).toBeNull()
  })

  it('rejects malformed persisted display graphs during hydration', () => {
    const conversation = hydrateConversation({
      id: 'conv-malformed-display',
      title: 'malformed',
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
      },
      backtestResult: null,
      logicGraph: null,
      displayLogicGraph: {
        blocks: [
          {
            type: 'IF',
            items: { invalid: true },
          },
        ],
      } as unknown,
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
    })

    expect(conversation.displayLogicGraph).toBeNull()
  })

  it('does not treat missing published snapshot param truth as implicit executable defaults during hydration', () => {
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
      publishedSnapshotParamValues: null,
      publishedScriptCode: 'return { ok: true }',
      publishedScriptGraphVersion: 1,
      latestSignalMessage: null,
      backtestExecutionConfigExplicit: false,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    })

    expect(conversation.backtestExecutionConfigExplicit).toBe(false)
    expect(conversation.publishedSnapshotParamValues).toBeNull()
    expect(conversation.paramValues.backtestInitialCash).toBeUndefined()
    expect(conversation.paramValues.backtestLeverage).toBeUndefined()
    expect(conversation.paramValues.backtestSlippageBps).toBeUndefined()
    expect(conversation.paramValues.backtestFeeBps).toBeUndefined()
    expect(conversation.paramValues.backtestPriceSource).toBeUndefined()
    expect(conversation.paramValues.backtestAllowPartial).toBeUndefined()
  })

  it('hydrates snapshot backtest defaults over legacy implicit local execution values', () => {
    const conversation = hydrateConversation({
      id: 'conv-published-snapshot-defaults',
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
      logicGraph: null,
      semanticGraph: null,
      validationReport: null,
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 25000,
        leverage: null,
        slippageBps: 12,
        feeBps: 4,
        priceSource: 'mid',
        allowPartial: false,
      },
      publishedScriptCode: 'return { ok: true }',
      publishedScriptGraphVersion: 1,
      latestSignalMessage: null,
      backtestExecutionConfigExplicit: false,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    })

    expect(conversation.backtestExecutionConfigExplicit).toBe(false)
    expect(conversation.paramValues).toEqual(expect.objectContaining({
      backtestInitialCash: 25000,
      backtestLeverage: null,
      backtestSlippageBps: 12,
      backtestFeeBps: 4,
      backtestPriceSource: 'mid',
      backtestAllowPartial: false,
    }))
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

  it('normalizes hydrated clarification gates so server-owned conversations preserve blocked parity', () => {
    const conversation = createConversationFromServerConversation({
      id: 'server-conv-clarification',
      conversationTitle: '澄清会话',
      status: 'CONFIRM_GATE',
      canonicalDigest: 'sha256:canonical-3',
      clarificationGate: {
        blocked: false,
        pendingItems: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: 'spot or perp?',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
    } as any, (key: string) => key)

    expect(conversation.clarificationGate?.blocked).toBe(true)
    expect(conversation.clarificationGate?.items).toHaveLength(1)
    expect(conversation.pendingCanonicalDigest).toBeNull()
  })

  it('persists published snapshot params separately from editable param values', () => {
    const serialized = serializePersistedConversations([
      {
        id: 'conv-persisted-published',
        serverConversationId: 'server-conv-persisted',
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
        publishedSnapshotParamValues: {
          backtestInitialCash: 10000,
          backtestLeverage: 1,
          backtestSlippageBps: 10,
          backtestFeeBps: 5,
          backtestPriceSource: 'close',
          backtestAllowPartial: true,
        },
        publishedSnapshotBacktestConfigDefaults: {
          initialCash: 25000,
          leverage: null,
          slippageBps: 12,
          feeBps: 4,
          priceSource: 'mid',
          allowPartial: false,
        },
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
    expect(envelope.conversations[0].publishedSnapshotParamValues).toEqual({
      backtestInitialCash: 10000,
      backtestLeverage: 1,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    })
    expect(envelope.conversations[0].paramValues).toEqual(expect.objectContaining({
      backtestInitialCash: 25000,
      backtestLeverage: null,
      backtestSlippageBps: 12,
      backtestFeeBps: 4,
      backtestPriceSource: 'mid',
      backtestAllowPartial: false,
    }))
  })

  it('restores serverConversationId when a persisted local conversation is hydrated from storage', () => {
    const raw = serializePersistedConversations([
      {
        id: 'conv-persisted-local',
        serverConversationId: 'server-conv-1',
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
        },
        backtestResult: null,
        logicGraph: null,
        displayLogicGraph: null,
        codegenSpecDesc: null,
        semanticGraph: null,
        validationReport: null,
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: null,
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: null,
        publishedSnapshotId: null,
        publishedSnapshotParamValues: null,
        publishedSnapshotStrategyConfig: null,
        publishedSnapshotBacktestConfigDefaults: null,
        publishedSnapshotDeploymentExecutionDefaults: null,
        publishedSnapshotDeploymentExecutionConstraints: null,
        publishedSnapshotCompatibilityMetadata: null,
        publishedScriptCode: null,
        publishedScriptGraphVersion: null,
        latestSignalMessage: null,
        backtestExecutionConfigExplicit: false,
        backtestExecutionState: 'idle',
        updatedAt: 1,
        schemaVersion: AI_QUANT_PERSISTED_SCHEMA_VERSION,
      },
    ], 'deploy-2026-04-11')

    const restored = readPersistedConversations({
      raw,
      translate: (key: string) => key,
      version: 'deploy-2026-04-11',
    })

    expect(restored.conversations[0]?.id).toBe('conv-persisted-local')
    expect(restored.conversations[0]?.serverConversationId).toBe('server-conv-1')
  })

  it('does not require republish when only backtest range changes', () => {
    expect(requiresRepublishForPublishedSnapshot({
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        backtestInitialCash: 10000,
      },
      editableParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        backtestInitialCash: 10000,
        backtestRangePreset: '7D',
      },
    })).toBe(false)
  })

  it('does not require republish when only editable execution params drift', () => {
    expect(requiresRepublishForPublishedSnapshot({
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        backtestLeverage: 1,
      },
      editableParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        backtestLeverage: 3,
      },
    })).toBe(false)
  })

  it('requires republish when compatibility metadata says published backtest truth is incomplete', () => {
    expect(requiresRepublishForPublishedSnapshot({
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
      },
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot: true,
        missingBacktestConfigDefaults: true,
        missingDeploymentExecutionDefaults: true,
        missingDeploymentExecutionConstraints: true,
        requiresRepublishForBacktest: true,
        requiresRepublishForDeploy: true,
      },
      editableParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
      },
    })).toBe(true)
  })

  it('resolves published backtest market inputs only from snapshot-bound truth', () => {
    expect(resolveEffectivePublishedBacktestInputs({
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        marketType: 'perp',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })).toEqual({
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      baseTimeframe: '1h',
    })
  })

  it('hydrates structured published snapshot projection from a server conversation', () => {
    const conversation = createConversationFromServerConversation({
      id: 'server-conv-3',
      conversationTitle: '结构化快照会话',
      status: 'PUBLISHED',
      scriptCode: 'export default function strategy() { return true }',
      publishedSnapshotId: 'snapshot-structured',
      publishedSnapshotParamValues: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 12,
        buyDropPct: 1.25,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 12,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 12000,
        leverage: 2,
        slippageBps: 8,
        feeBps: 4,
        priceSource: 'close',
        allowPartial: false,
      },
      publishedSnapshotDeploymentExecutionDefaults: {
        leverage: 2,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      publishedSnapshotDeploymentExecutionConstraints: {
        effectiveAllowedLeverageRange: { min: 1, max: 3 },
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'snapshot constrained',
      },
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
      specDesc: {
        market: {
          symbols: ['ETHUSDT'],
          timeframes: ['15m'],
        },
        rules: [],
      },
    } as any, (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key))

    expect(conversation.publishedSnapshotId).toBe('snapshot-structured')
    expect(conversation.publishedSnapshotParamValues).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      marketType: 'perp',
      baseTimeframe: '15m',
      positionPct: 12,
      buyDropPct: 1.25,
    })
    expect(conversation.publishedSnapshotStrategyConfig).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      marketType: 'perp',
      baseTimeframe: '15m',
      positionPct: 12,
      strategyDeclaredLeverageRange: null,
    })
    expect(conversation.publishedSnapshotBacktestConfigDefaults).toEqual({
      initialCash: 12000,
      leverage: 2,
      slippageBps: 8,
      feeBps: 4,
      priceSource: 'close',
      allowPartial: false,
    })
    expect(conversation.publishedSnapshotDeploymentExecutionDefaults).toEqual({
      leverage: 2,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'gtc',
    })
    expect(conversation.publishedSnapshotCompatibilityMetadata).toEqual({
      isLegacySnapshot: false,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    })
  })

  it('keeps authoritative published snapshot param values during hydration when strategy config is only a subset', () => {
    const conversation = hydrateConversation({
      id: 'conv-hydrated-structured',
      title: 'hydrated',
      messages: [],
      params: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 12,
      },
      paramValues: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 12,
      },
      publishedSnapshotId: 'snapshot-hydrated',
      publishedSnapshotParamValues: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 12,
        buyDropPct: 1.5,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 12,
      },
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'confirmed',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          timeframe: '15m',
          positionPct: 12,
        },
      },
      semanticGraph: null,
      validationReport: null,
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: null,
      publishedScriptCode: 'export default function strategy() { return true }',
      publishedScriptGraphVersion: 1,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    } as any)

    expect(conversation.publishedSnapshotParamValues).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      marketType: 'perp',
      baseTimeframe: '15m',
      positionPct: 12,
      buyDropPct: 1.5,
    })
  })

})
