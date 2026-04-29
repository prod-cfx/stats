import { GridRuntimeRepository } from './grid-runtime.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof GridRuntimeRepository>[0] {
  return { tx } as ConstructorParameters<typeof GridRuntimeRepository>[0]
}

describe('GridRuntimeRepository', () => {
  it('creates an instance with deterministic nested levels', async () => {
    const tx = {
      gridRuntimeInstance: {
        create: jest.fn().mockResolvedValue({ id: 'grid-1', levels: [] }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.createInstanceWithLevels({
      strategyInstanceId: 'strategy-instance-1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      mode: 'perp_long',
      configSnapshot: { mode: 'perp_long', lowerPrice: '90' },
      levels: [
        { levelIndex: 0, price: '90', side: 'buy', role: 'open_long', baseQuantity: '1.111111111111111111', quoteBudget: '100', status: 'planned' },
        { levelIndex: 1, price: '100', side: 'buy', role: 'anchor', baseQuantity: null, quoteBudget: null, status: 'anchor' },
      ],
    })

    expect(tx.gridRuntimeInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        strategyInstanceId: 'strategy-instance-1',
        publishedSnapshotId: 'snapshot-1',
        userId: 'user-1',
        exchangeAccountId: 'exchange-account-1',
        exchangeId: 'okx',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        mode: 'perp_long',
        configSnapshot: { mode: 'perp_long', lowerPrice: '90' },
        levels: {
          create: [
            expect.objectContaining({ levelIndex: 0, price: expect.anything(), side: 'buy', role: 'open_long', status: 'planned' }),
            expect.objectContaining({ levelIndex: 1, price: expect.anything(), side: 'buy', role: 'anchor', status: 'anchor' }),
          ],
        },
      }),
      include: { levels: { orderBy: { levelIndex: 'asc' } } },
    })
  })

  it('finds an instance only within the requested user scope', async () => {
    const tx = {
      gridRuntimeInstance: {
        findFirst: jest.fn().mockResolvedValue({ id: 'grid-1', userId: 'user-1' }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.findInstanceForUser({ id: 'grid-1', userId: 'user-1' })

    expect(tx.gridRuntimeInstance.findFirst).toHaveBeenCalledWith({
      where: { id: 'grid-1', userId: 'user-1' },
      include: { levels: { orderBy: { levelIndex: 'asc' } } },
    })
  })

  it('lists orders by instance creation order', async () => {
    const tx = {
      gridOrder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.listOrders('grid-1')

    expect(tx.gridOrder.findMany).toHaveBeenCalledWith({
      where: { gridRuntimeInstanceId: 'grid-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  })

  it('creates planned orders and moves them through submitting and open states', async () => {
    const tx = {
      gridOrder: {
        create: jest.fn().mockResolvedValue({ id: 'order-1', status: 'PLANNED' }),
        update: jest.fn().mockResolvedValue({ id: 'order-1', status: 'OPEN' }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.createPlannedOrder({
      gridRuntimeInstanceId: 'grid-1',
      gridLevelId: 'level-1',
      clientOrderId: 'client-1',
      side: 'buy',
      role: 'open_long',
      orderType: 'limit',
      timeInForce: 'gtc',
      price: '90',
      quantity: '1.111111111111111111',
      rawPayload: { source: 'planner' },
    })
    await repo.markOrderSubmitting({ id: 'order-1', clientOrderId: 'client-1', rawPayload: { requestId: 'req-1' } })
    await repo.markOrderOpen({ id: 'order-1', exchangeOrderId: 'exchange-1', rawPayload: { state: 'live' } })

    expect(tx.gridOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gridRuntimeInstanceId: 'grid-1',
        gridLevelId: 'level-1',
        clientOrderId: 'client-1',
        side: 'buy',
        role: 'open_long',
        orderType: 'limit',
        timeInForce: 'gtc',
        price: expect.anything(),
        quantity: expect.anything(),
        status: 'PLANNED',
        rawPayload: { source: 'planner' },
      }),
    })
    expect(tx.gridOrder.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'order-1' },
      data: { clientOrderId: 'client-1', status: 'SUBMITTING', rawPayload: { requestId: 'req-1' } },
    })
    expect(tx.gridOrder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'order-1' },
      data: { exchangeOrderId: 'exchange-1', status: 'OPEN', rawPayload: { state: 'live' } },
    })
  })

  it('records each exchange fill once by instance and fill id', async () => {
    const existingFill = { id: 'fill-1', exchangeFillId: 'exchange-fill-1' }
    const tx = {
      gridFill: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(existingFill)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({ id: 'fill-2', exchangeFillId: 'exchange-fill-2' }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    const duplicate = await repo.recordFillOnce({
      gridRuntimeInstanceId: 'grid-1',
      gridOrderId: 'order-1',
      exchangeFillId: 'exchange-fill-1',
      side: 'buy',
      price: '90',
      quantity: '1',
      filledAt: new Date('2026-04-29T00:00:00.000Z'),
    })
    const created = await repo.recordFillOnce({
      gridRuntimeInstanceId: 'grid-1',
      gridOrderId: 'order-1',
      exchangeFillId: 'exchange-fill-2',
      tradeId: 'trade-2',
      side: 'buy',
      price: '90',
      quantity: '1',
      fee: '0.01',
      feeCurrency: 'USDT',
      filledAt: new Date('2026-04-29T00:01:00.000Z'),
      rawPayload: { okx: true },
    })

    expect(duplicate).toBe(existingFill)
    expect(created.exchangeFillId).toBe('exchange-fill-2')
    expect(tx.gridFill.create).toHaveBeenCalledTimes(1)
    expect(tx.gridFill.findUnique).toHaveBeenCalledWith({
      where: {
        gridRuntimeInstanceId_exchangeFillId: {
          gridRuntimeInstanceId: 'grid-1',
          exchangeFillId: 'exchange-fill-1',
        },
      },
    })
  })

  it('returns the existing fill when concurrent create hits the fill id unique constraint', async () => {
    const existingFill = { id: 'fill-existing', exchangeFillId: 'exchange-fill-1' }
    const uniqueConstraintError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    const tx = {
      gridFill: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingFill),
        create: jest.fn().mockRejectedValue(uniqueConstraintError),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    const result = await repo.recordFillOnce({
      gridRuntimeInstanceId: 'grid-1',
      gridOrderId: 'order-1',
      exchangeFillId: 'exchange-fill-1',
      side: 'buy',
      price: '90',
      quantity: '1',
      filledAt: new Date('2026-04-29T00:00:00.000Z'),
    })

    expect(result).toBe(existingFill)
    expect(tx.gridFill.create).toHaveBeenCalledTimes(1)
    expect(tx.gridFill.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        gridRuntimeInstanceId_exchangeFillId: {
          gridRuntimeInstanceId: 'grid-1',
          exchangeFillId: 'exchange-fill-1',
        },
      },
    })
  })

  it('appends runtime events', async () => {
    const tx = {
      gridRuntimeEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.appendEvent({
      gridRuntimeInstanceId: 'grid-1',
      eventType: 'order_opened',
      severity: 'info',
      status: 'OPEN',
      message: 'Order opened',
      payload: { orderId: 'order-1' },
    })

    expect(tx.gridRuntimeEvent.create).toHaveBeenCalledWith({
      data: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'order_opened',
        severity: 'info',
        status: 'OPEN',
        message: 'Order opened',
        payload: { orderId: 'order-1' },
      },
    })
  })
})
