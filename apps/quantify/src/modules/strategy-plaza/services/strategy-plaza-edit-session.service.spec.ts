import { StrategyPlazaEditSessionService } from './strategy-plaza-edit-session.service'

const verifiedBacktestDraftConfig = {
  range: {
    preset: 'CUSTOM' as const,
    startAt: '2026-03-08T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
  },
  execution: {
    initialCash: 10000,
    leverage: 2,
    slippageBps: 10,
    feeBps: 5,
    priceSource: 'close' as const,
    allowPartial: false,
  },
}

describe('StrategyPlazaEditSessionService', () => {
  it('starts a codegen session from the official template edit seed', async () => {
    const template = {
      id: 'ma-cross',
      editSeed: {
        initialMessage: 'Build a MA cross strategy',
        guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
      },
      runConfig: {
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        timeframe: '15m',
        positionPct: 10,
        leverage: 2,
        deploymentExecutionConfig: { priceSource: 'close', orderType: 'market', timeInForce: 'ioc' },
      },
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-1', conversationId: 'conversation-1' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    const result = await service.startEditSession({
      userId: 'user-1',
      templateId: 'ma-cross',
    })

    expect(templates.getRequired).toHaveBeenCalledWith('ma-cross')
    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: 'Build a MA cross strategy',
      guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
      locale: 'zh',
    }, 'user-1')
    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-1',
      'user-1',
      expect.objectContaining({
        range: expect.objectContaining({ preset: 'CUSTOM' }),
        execution: expect.objectContaining({ leverage: 2, allowPartial: false }),
      }),
    )
    expect(result).toEqual({
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Build a MA cross strategy',
    })
  })

  it('starts another plaza template through the shared codegen session path', async () => {
    const template = {
      id: 'rsi-reversal',
      editSeed: {
        initialMessage: 'Build an RSI reversal strategy',
        guideConfig: { symbolExample: 'ETHUSDT', timeframeExample: '1h' },
      },
      runConfig: {
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'ETH-USDT',
        timeframe: '1h',
        positionPct: 10,
        leverage: null,
        deploymentExecutionConfig: { priceSource: 'close', orderType: 'market', timeInForce: 'ioc' },
      },
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-2', conversationId: 'conversation-2' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    const result = await service.startEditSession({
      userId: 'user-2',
      templateId: 'rsi-reversal',
    })

    expect(templates.getRequired).toHaveBeenCalledWith('rsi-reversal')
    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: 'Build an RSI reversal strategy',
      guideConfig: { symbolExample: 'ETHUSDT', timeframeExample: '1h' },
      locale: 'zh',
    }, 'user-2')
    expect(result).toEqual({
      sessionId: 'session-2',
      templateId: 'rsi-reversal',
      initialMessage: 'Build an RSI reversal strategy',
    })
  })

  it('uses the English edit seed when locale is en', async () => {
    const template = {
      id: 'ma-cross',
      editSeed: {
        initialMessage: '创建 MA 策略',
        guideConfig: { entryRuleExample: 'MA6 上穿 MA48' },
        locales: {
          en: {
            initialMessage: 'Create a MA crossover strategy',
            guideConfig: { entryRuleExample: 'MA6 crosses above MA48' },
          },
        },
      },
      runConfig: {
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        timeframe: '15m',
        positionPct: 10,
        leverage: 2,
        deploymentExecutionConfig: { priceSource: 'close', orderType: 'market', timeInForce: 'ioc' },
      },
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-en', conversationId: 'conversation-en' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    const result = await service.startEditSession({
      userId: 'user-en',
      templateId: 'ma-cross',
      locale: 'en',
    })

    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: 'Create a MA crossover strategy',
      guideConfig: { entryRuleExample: 'MA6 crosses above MA48' },
      locale: 'en',
    }, 'user-en')
    expect(result.initialMessage).toBe('Create a MA crossover strategy')
  })

  it('persists the official verified backtest window for plaza edit conversations', async () => {
    const template = {
      id: 'orderbook-imbalance-long',
      editSeed: {
        initialMessage: 'Build orderbook imbalance strategy',
        guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '1m' },
      },
      runConfig: {
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        timeframe: '1m',
        positionPct: 10,
        leverage: 2,
        deploymentExecutionConfig: { priceSource: 'close', orderType: 'market', timeInForce: 'ioc' },
      },
    }
    const templates = { getRequired: jest.fn().mockReturnValue(template) }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-book', conversationId: 'conversation-book' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
      { build: jest.fn().mockReturnValue(verifiedBacktestDraftConfig) } as never,
    )

    await service.startEditSession({ userId: 'user-1', templateId: 'orderbook-imbalance-long' })

    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-book',
      'user-1',
      verifiedBacktestDraftConfig,
    )
  })
})
