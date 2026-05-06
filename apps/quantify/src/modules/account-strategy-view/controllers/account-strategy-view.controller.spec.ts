import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import { AccountStrategyViewController } from './account-strategy-view.controller'

jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => descriptor,
}))

describe('accountStrategyViewController', () => {
  function createController(service: Record<string, jest.Mock>) {
    const callerIdentityService = {
      resolveCallerUserIdFromAuthorization: jest.fn().mockReturnValue('caller-u1'),
    }
    return {
      controller: new AccountStrategyViewController(service as any, callerIdentityService as any),
      callerIdentityService,
    }
  }

  it('uses caller identity from authorization for list request', async () => {
    const service = {
      listStrategies: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      deleteStrategy: jest.fn().mockResolvedValue(undefined),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.list({
      page: 1,
      limit: 20,
      status: 'running',
      userId: 'attacker',
      subscribedOnly: true,
      excludeDraft: true,
    } as any, 'Bearer token', 'caller-u1')

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.listStrategies).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'caller-u1',
        subscribedOnly: true,
        excludeDraft: true,
      }),
    )
  })

  it('uses caller identity from authorization for detail request', async () => {
    const service = {
      getStrategyDetail: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.detail('inst-1', 'Bearer token', 'caller-u1')

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.getStrategyDetail).toHaveBeenCalledWith('caller-u1', 'inst-1')
  })

  it('uses caller identity from authorization for deploy-result lookup', async () => {
    const service = {
      getDeployResult: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.deployResult('deploy-req-1', 'Bearer token', 'caller-u1')

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.getDeployResult).toHaveBeenCalledWith('caller-u1', 'deploy-req-1')
  })

  it('injects caller userId into action dto', async () => {
    const service = {
      performAction: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.action(
      'inst-1',
      { action: AccountStrategyAction.RUN, userId: 'attacker' } as any,
      'Bearer token',
      'caller-u1',
    )

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.performAction).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ userId: 'caller-u1', action: AccountStrategyAction.RUN }),
    )
  })

  it('injects caller userId into deploy dto', async () => {
    const service = {
      deployStrategy: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.deploy(
      {
        userId: 'attacker',
        name: '测试策略',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '5m/15m',
        positionPct: 10,
        deployRequestId: 'req-1',
      } as any,
      'Bearer token',
      'caller-u1',
    )

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.deployStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'caller-u1',
        exchange: 'binance',
      }),
    )
  })

  it('uses caller identity from authorization for delete request', async () => {
    const service = {
      deleteStrategy: jest.fn().mockResolvedValue(undefined),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.remove('inst-1', 'Bearer token', 'caller-u1')

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.deleteStrategy).toHaveBeenCalledWith('caller-u1', 'inst-1', { archiveLinkedConversations: true })
  })

  it('injects caller userId into deployment leverage update dto', async () => {
    const service = {
      updateDeploymentLeverage: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const { controller, callerIdentityService } = createController(service)

    await controller.updateDeploymentLeverage(
      'inst-1',
      {
        userId: 'attacker',
        leverage: 4,
        reason: 'reduce risk',
      } as any,
      'Bearer token',
      'caller-u1',
    )

    expect(callerIdentityService.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'caller-u1')
    expect(service.updateDeploymentLeverage).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        userId: 'caller-u1',
        leverage: 4,
        reason: 'reduce risk',
      }),
    )
  })
})
