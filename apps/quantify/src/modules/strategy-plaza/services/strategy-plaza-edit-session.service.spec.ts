import { StrategyPlazaEditSessionService } from './strategy-plaza-edit-session.service'

describe('StrategyPlazaEditSessionService', () => {
  it('starts a codegen session from the official template edit seed', async () => {
    const template = {
      id: 'ma-cross',
      editSeed: {
        initialMessage: 'Build a MA cross strategy',
        guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
      },
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
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
    }, 'user-1')
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
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-2' }),
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
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-en' }),
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
    }, 'user-en')
    expect(result.initialMessage).toBe('Create a MA crossover strategy')
  })
})
