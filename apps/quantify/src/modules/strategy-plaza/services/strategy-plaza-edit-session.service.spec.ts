import { StrategyPlazaEditSessionService } from './strategy-plaza-edit-session.service'
import { Test } from '@nestjs/testing'
import { CodegenConversationService } from '@/modules/llm-strategy-codegen/services/codegen-conversation.service'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { buildOfficialTemplateBacktestConfigDefaults } from '../utils/official-strategy-plaza-snapshot-content'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

describe('StrategyPlazaEditSessionService', () => {
  it('compiles in Nest without a custom backtest draft builder provider', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StrategyPlazaEditSessionService,
        { provide: OfficialStrategyPlazaTemplateService, useValue: { getRequired: jest.fn() } },
        {
          provide: CodegenConversationService,
          useValue: {
            startSession: jest.fn(),
            updateConversationBacktestDraft: jest.fn(),
          },
        },
      ],
    }).compile()

    expect(moduleRef.get(StrategyPlazaEditSessionService)).toBeInstanceOf(StrategyPlazaEditSessionService)
  })

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
        range: expect.objectContaining({ preset: '30D' }),
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

  it('persists a 30D backtest range for plaza edit conversations', async () => {
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
    )

    await service.startEditSession({ userId: 'user-1', templateId: 'orderbook-imbalance-long' })

    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-book',
      'user-1',
      expect.objectContaining({ range: { preset: '30D' } }),
    )
  })

  it('uses the 30D default backtest window for templates that depend on external event feeds', () => {
    const orderbookTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'orderbook-imbalance-long')!
    const fundingOiTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'funding-oi-confirmation')!

    expect(buildOfficialTemplateBacktestConfigDefaults(orderbookTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '30D' }),
    }))
    expect(buildOfficialTemplateBacktestConfigDefaults(fundingOiTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '30D' }),
    }))
  })

  it('persists a 30D backtest range when using the default draft builder', async () => {
    const orderbookTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'orderbook-imbalance-long')!
    const templates = { getRequired: jest.fn().mockReturnValue(orderbookTemplate) }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-book', conversationId: 'conversation-book' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    await service.startEditSession({ userId: 'user-1', templateId: 'orderbook-imbalance-long' })

    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-book',
      'user-1',
      expect.objectContaining({
        range: expect.objectContaining({ preset: '30D' }),
      }),
    )
  })

  it('does not require official backtest evidence to create an edit conversation', async () => {
    const template = {
      id: 'template-without-evidence',
      editSeed: {
        initialMessage: 'Build DCA strategy',
        guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '1h' },
      },
      runConfig: {
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        timeframe: '1h',
        positionPct: 70,
        leverage: 2,
        deploymentExecutionConfig: { priceSource: 'close', orderType: 'market', timeInForce: 'ioc' },
      },
    }
    const templates = { getRequired: jest.fn().mockReturnValue(template) }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-dca', conversationId: 'conversation-dca' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    await expect(service.startEditSession({ userId: 'user-1', templateId: 'template-without-evidence' })).resolves.toEqual({
      sessionId: 'session-dca',
      templateId: 'template-without-evidence',
      initialMessage: 'Build DCA strategy',
    })
    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-dca',
      'user-1',
      expect.objectContaining({
        range: { preset: '30D' },
        execution: expect.objectContaining({ leverage: 2 }),
      }),
    )
  })

  it('uses the 30D default backtest window for templates without external event feeds', () => {
    const maTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'ma-cross')!

    expect(buildOfficialTemplateBacktestConfigDefaults(maTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '30D' }),
    }))
  })

  it('starts EMA trend continuation edit through the first-turn semantic recognition path', async () => {
    const emaTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'ema-trend-continuation')!
    const templates = { getRequired: jest.fn().mockReturnValue(emaTemplate) }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-ema', conversationId: 'conversation-ema' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    await service.startEditSession({ userId: 'user-1', templateId: 'ema-trend-continuation' })

    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 EMA 趋势延续策略。规则：价格高于 EMA50 且 EMA20 高于 EMA50 时，按每 4 根 15m K线的节奏开多。出场：止盈 0.12%、止损 1.5%、持仓满 4 根 K线、或价格跌破 EMA20，任一触发即平多。风控：仓位 25%，2 倍杠杆。',
      guideConfig: emaTemplate.editSeed.guideConfig,
      locale: 'zh',
    }, 'user-1')
  })

  it('uses the 7D default backtest window only for selected official templates', async () => {
    const emaTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'ema-trend-continuation')!
    const breakdownTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'breakdown-short-follow')!
    const maTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(template => template.id === 'ma-cross')!
    const templates = { getRequired: jest.fn().mockReturnValue(breakdownTemplate) }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-breakdown', conversationId: 'conversation-breakdown' }),
      updateConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    await service.startEditSession({ userId: 'user-1', templateId: 'breakdown-short-follow' })

    expect(buildOfficialTemplateBacktestConfigDefaults(emaTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '7D' }),
    }))
    expect(buildOfficialTemplateBacktestConfigDefaults(breakdownTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '7D' }),
    }))
    expect(buildOfficialTemplateBacktestConfigDefaults(maTemplate)).toEqual(expect.objectContaining({
      range: expect.objectContaining({ preset: '30D' }),
    }))
    expect(codegenConversationService.updateConversationBacktestDraft).toHaveBeenCalledWith(
      'conversation-breakdown',
      'user-1',
      expect.objectContaining({
        range: expect.objectContaining({ preset: '7D' }),
      }),
    )
  })
})
