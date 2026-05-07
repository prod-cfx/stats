import { upsertSeedStrategyInstance } from './seed-strategy-instance'

describe('upsertSeedStrategyInstance', () => {
  it('updates an existing visible official strategy instance without relying on a removed compound unique key', async () => {
    const client = {
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue({ id: 'instance-1' }),
        update: jest.fn().mockResolvedValue({ id: 'instance-1' }),
        create: jest.fn(),
      },
    }

    await expect(upsertSeedStrategyInstance(client, {
      strategyTemplateId: 'template-1',
      name: 'MA 均线交叉 官方源模板',
      description: '短均线上穿长均线做多，跌回长均线下方退出。',
      llmModel: 'official-strategy-plaza',
      params: { symbol: 'BTC-USDT-SWAP' },
      userId: 'official-strategy-plaza',
      metadata: { source: 'strategy-plaza-official-template' },
    })).resolves.toEqual({ id: 'instance-1' })

    expect(client.strategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        strategyTemplateId: 'template-1',
        llmModel: 'official-strategy-plaza',
        name: 'MA 均线交叉 官方源模板',
        createdBy: 'official-strategy-plaza',
        archivedAt: null,
      },
      select: { id: true },
    })
    expect(client.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'instance-1' },
      data: {
        description: '短均线上穿长均线做多，跌回长均线下方退出。',
        params: { symbol: 'BTC-USDT-SWAP' },
        updatedBy: 'official-strategy-plaza',
        metadata: { source: 'strategy-plaza-official-template' },
      },
      select: { id: true },
    })
    expect(client.strategyInstance.create).not.toHaveBeenCalled()
  })

  it('creates the official strategy instance when no visible one exists', async () => {
    const client = {
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'instance-2' }),
      },
    }

    await expect(upsertSeedStrategyInstance(client, {
      strategyTemplateId: 'template-1',
      name: 'MA 均线交叉 官方源模板',
      description: '短均线上穿长均线做多，跌回长均线下方退出。',
      llmModel: 'official-strategy-plaza',
      params: { symbol: 'BTC-USDT-SWAP' },
      userId: 'official-strategy-plaza',
      metadata: { source: 'strategy-plaza-official-template' },
    })).resolves.toEqual({ id: 'instance-2' })

    expect(client.strategyInstance.create).toHaveBeenCalledWith({
      data: {
        strategyTemplateId: 'template-1',
        name: 'MA 均线交叉 官方源模板',
        description: '短均线上穿长均线做多，跌回长均线下方退出。',
        llmModel: 'official-strategy-plaza',
        params: { symbol: 'BTC-USDT-SWAP' },
        status: 'draft',
        mode: 'PAPER',
        createdBy: 'official-strategy-plaza',
        updatedBy: 'official-strategy-plaza',
        metadata: { source: 'strategy-plaza-official-template' },
      },
      select: { id: true },
    })
    expect(client.strategyInstance.update).not.toHaveBeenCalled()
  })
})
