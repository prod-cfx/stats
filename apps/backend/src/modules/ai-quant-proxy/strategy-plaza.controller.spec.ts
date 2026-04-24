import { StrategyPlazaProxyController } from './strategy-plaza.controller'

describe('strategyPlazaProxyController', () => {
  function createController() {
    const service = {
      listStrategyPlazaTemplates: jest.fn().mockResolvedValue([{ id: 'ma-cross' }]),
      getStrategyPlazaTemplateDetail: jest.fn().mockResolvedValue({ id: 'ma-cross' }),
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

    await expect(controller.list()).resolves.toEqual([{ id: 'ma-cross' }])

    expect(service.listStrategyPlazaTemplates).toHaveBeenCalledWith()
  })

  it('publicly proxies strategy plaza template detail by slug', async () => {
    const { controller, service } = createController()

    await expect(controller.detail('bollinger-reversion')).resolves.toEqual({ id: 'ma-cross' })

    expect(service.getStrategyPlazaTemplateDetail).toHaveBeenCalledWith('bollinger-reversion')
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

    await controller.editSession('user-1', 'Bearer token-1', 'bollinger-reversion')

    expect(service.startStrategyPlazaEditSession).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'bollinger-reversion',
    )
  })
})
