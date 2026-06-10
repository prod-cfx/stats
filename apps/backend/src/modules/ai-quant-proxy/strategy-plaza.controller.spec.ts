import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { StrategyPlazaProxyController } from './strategy-plaza.controller'
import { StrategyPlazaTemplateResponseDto } from './dto/strategy-plaza.response.dto'

describe('strategyPlazaProxyController', () => {
  const templatePayload = {
    id: 'ma-cross',
    officialBacktest: {
      generatedAt: '2026-06-10T04:45:41.674Z',
      backtestFrom: 1775008800000,
      backtestTo: 1777167900000,
      source: 'https://www.okx.com/api/v5/market/history-candles',
      dataSource: {
        exchange: 'okx',
        marketType: 'swap',
        endpoint: 'https://www.okx.com/api/v5/market/history-candles',
        fixedEndTs: 1777168800000,
        pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
      },
      candleCount: 2400,
      metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
      equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10177.53 }],
      confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
      disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
    },
  }

  function createController() {
    const service = {
      listStrategyPlazaTemplates: jest.fn().mockResolvedValue([templatePayload]),
      getStrategyPlazaTemplateDetail: jest.fn().mockResolvedValue(templatePayload),
      runStrategyPlazaTemplate: jest.fn().mockResolvedValue({ id: 'strategy-1' }),
      startStrategyPlazaEditSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        templateId: 'ma-cross',
        initialMessage: 'Edit this strategy',
      }),
    }
    const controller = new StrategyPlazaProxyController(service as never)
    return { controller, service }
  }

  it('publicly proxies strategy plaza template list without user identity', async () => {
    const { controller, service } = createController()

    await expect(controller.list()).resolves.toEqual([templatePayload])

    expect(service.listStrategyPlazaTemplates).toHaveBeenCalledWith()
  })

  it('publicly proxies strategy plaza template detail by slug', async () => {
    const { controller, service } = createController()

    await expect(controller.detail('bollinger-reversion')).resolves.toEqual(templatePayload)

    expect(service.getStrategyPlazaTemplateDetail).toHaveBeenCalledWith('bollinger-reversion')
  })

  it('declares official backtest data in the backend proxy dto contract', () => {
    const properties = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, StrategyPlazaTemplateResponseDto.prototype)

    expect(properties).toContain(':officialBacktest')
  })

  it('runs templates with backend-controlled user/auth and only runRequestId body', async () => {
    const { controller, service } = createController()

    await controller.run(
      'user-1',
      'Bearer token-1',
      'ma-cross',
      {
        runRequestId: 'plaza-run-12345678',
        marketType: 'spot',
        symbol: 'ETH-USDT',
        positionPct: 99,
        leverage: 99,
      } as never,
    )

    expect(service.runStrategyPlazaTemplate).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'ma-cross',
      { runRequestId: 'plaza-run-12345678' },
    )
  })

  it('starts edit sessions with backend-controlled user/auth and no body payload', async () => {
    const { controller, service } = createController()

    await controller.editSession('user-1', 'Bearer token-1', 'bollinger-reversion', 'en')

    expect(service.startStrategyPlazaEditSession).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'bollinger-reversion',
      { locale: 'en' },
    )
  })
})
