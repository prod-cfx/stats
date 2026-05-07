import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'
import { AccountAiQuantActionRequestDto } from './dto/account-ai-quant-action.request.dto'

describe('accountAiQuantStrategiesController', () => {
  function createController() {
    const service = {
      listAccountStrategies: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      getAccountStrategyDetail: jest.fn().mockResolvedValue({ id: 'strategy-1' }),
      getDeployResult: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'running' }),
      performAccountStrategyAction: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'running' }),
      deployAccountStrategy: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'draft' }),
      updateAccountStrategyExecutionLeverage: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'draft' }),
      deleteAccountStrategy: jest.fn().mockResolvedValue(undefined),
    }

    const controller = new AccountAiQuantStrategiesController(service as any)
    return { controller, service }
  }

  it('lists strategies for the authenticated user only', async () => {
    const { controller, service } = createController()

    await controller.list('user-1', 'Bearer token-1', {
      page: 2,
      limit: 10,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })

    expect(service.listAccountStrategies).toHaveBeenCalledWith('user-1', 'Bearer token-1', {
      page: 2,
      limit: 10,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })
  })

  it.each(['run', 'stop', 'liquidate_and_stop'] as const)(
    'accepts %s as a valid account strategy action dto value',
    (action) => {
      const dto = plainToInstance(AccountAiQuantActionRequestDto, { action })

      expect(validateSync(dto)).toHaveLength(0)
    },
  )

  it('rejects unsupported account strategy action dto values', () => {
    const dto = plainToInstance(AccountAiQuantActionRequestDto, { action: 'pause' })

    const errors = validateSync(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints).toMatchObject({
      isIn: expect.any(String),
    })
  })

  it('forwards authenticated user id when executing strategy actions', async () => {
    const { controller, service } = createController()

    await controller.action('user-1', 'Bearer token-1', 'strategy-1', {
      action: 'liquidate_and_stop',
      userId: 'attacker',
    } as any)

    expect(service.performAccountStrategyAction).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'strategy-1', {
      action: 'liquidate_and_stop',
    })
  })

  it('deploys strategies with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.deploy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-1',
      publishedSnapshotId: 'snapshot-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeAccountName: 'Binance Testnet',
      deploymentExecutionConfig: { leverage: 3 },
    })

    expect(service.deployAccountStrategy).toHaveBeenCalledWith('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-1',
      publishedSnapshotId: 'snapshot-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeAccountName: 'Binance Testnet',
      deploymentExecutionConfig: { leverage: 3 },
    })
  })

  it('looks up deploy result with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.deployResult('user-1', 'Bearer token-1', 'deploy-req-1')

    expect(service.getDeployResult).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'deploy-req-1')
  })

  it('updates execution leverage with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.updateExecutionLeverage('user-1', 'Bearer token-1', 'strategy-1', {
      leverage: 5,
    })

    expect(service.updateAccountStrategyExecutionLeverage).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'strategy-1',
      { leverage: 5 },
    )
  })

  it('deletes strategy without deleteStoppedStrategy by default', async () => {
    const { controller, service } = createController()

    await controller.remove('user-1', 'Bearer token-1', 'strategy-1')

    expect(service.deleteAccountStrategy).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'strategy-1', {
      deleteStoppedStrategy: false,
    })
  })

  it('forwards deleteStoppedStrategy=true query through to the service', async () => {
    const { controller, service } = createController()

    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', 'true')

    expect(service.deleteAccountStrategy).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'strategy-1', {
      deleteStoppedStrategy: true,
    })
  })

  it('parses boolean query liberally: accepts "true"/"TRUE"/"1" as true and rejects others as false', async () => {
    const { controller, service } = createController()

    // 'true' (lowercase 由前端默认拼接)
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', 'true')
    // 大写
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', 'TRUE')
    // 数字 1
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', '1')

    for (const call of (service.deleteAccountStrategy as jest.Mock).mock.calls) {
      expect(call[3]).toEqual({ deleteStoppedStrategy: true })
    }
    ;(service.deleteAccountStrategy as jest.Mock).mockClear()

    // 其它任何值（'false'、'0'、空串、未知字符串）一律视为 false
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', 'false')
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', '0')
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', '')
    await controller.remove('user-1', 'Bearer token-1', 'strategy-1', 'no')

    for (const call of (service.deleteAccountStrategy as jest.Mock).mock.calls) {
      expect(call[3]).toEqual({ deleteStoppedStrategy: false })
    }
  })
})
