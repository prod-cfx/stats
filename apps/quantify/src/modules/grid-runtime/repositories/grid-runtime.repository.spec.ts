import { GridRuntimeRepository } from './grid-runtime.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof GridRuntimeRepository>[0] {
  return {
    tx,
    withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  } as unknown as ConstructorParameters<typeof GridRuntimeRepository>[0]
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

  it('creates an instance and its initial planned orders atomically', async () => {
    const tx = {
      gridRuntimeInstance: {
        create: jest.fn().mockResolvedValue({
          id: 'grid-1',
          levels: [
            { id: 'level-0', levelIndex: 0 },
            { id: 'level-1', levelIndex: 1 },
          ],
        }),
      },
      gridOrder: {
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
    }
    const txHost = createTxHost(tx)
    const repo = new GridRuntimeRepository(txHost)

    await repo.createInstanceWithPlan({
      strategyInstanceId: 'strategy-instance-1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      mode: 'spot',
      configSnapshot: { mode: 'spot', lowerPrice: '90' },
      levels: [
        { levelIndex: 0, price: '90', side: 'buy', role: 'spot_buy', quoteBudget: '100', status: 'planned' },
        { levelIndex: 1, price: '100', side: 'buy', role: 'spot_buy', quoteBudget: '100', status: 'planned' },
      ],
      plannedOrders: [{
        levelIndex: 0,
        side: 'buy',
        role: 'spot_buy',
        orderType: 'limit',
        timeInForce: 'gtc',
        price: '90',
        quantity: '1.111111111111111111',
        rawPayload: { source: 'deployment' },
      }],
    })

    expect(txHost.withTransaction).toHaveBeenCalledTimes(1)
    expect(tx.gridOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gridRuntimeInstanceId: 'grid-1',
        gridLevelId: 'level-0',
        side: 'buy',
        role: 'spot_buy',
        price: expect.anything(),
        quantity: expect.anything(),
        rawPayload: { source: 'deployment' },
      }),
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    await repo.markOrderOpen({
      id: 'order-1',
      exchangeOrderId: 'exchange-1',
      price: '90.1',
      quantity: '1.1',
      rawPayload: { state: 'live' },
    })

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
    expect(tx.gridOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'PLANNED', instance: { status: { in: ['INITIALIZING', 'RUNNING'] } } },
      data: { clientOrderId: 'client-1', status: 'SUBMITTING', rawPayload: { requestId: 'req-1' } },
    })
    expect(tx.gridOrder.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'order-1', status: 'SUBMITTING', instance: { status: { in: ['INITIALIZING', 'RUNNING'] } } },
      data: {
        exchangeOrderId: 'exchange-1',
        price: expect.anything(),
        quantity: expect.anything(),
        status: 'OPEN',
        rawPayload: { state: 'live' },
      },
    })
  })

  it('records a new exchange fill with createMany skipDuplicates', async () => {
    const newFill = { id: 'fill-2', exchangeFillId: 'exchange-fill-2' }
    const tx = {
      gridFill: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(newFill),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

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

    expect(created).toEqual({ fill: newFill, newlyRecorded: true })
    expect(tx.gridFill.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gridRuntimeInstanceId: 'grid-1',
        gridOrderId: 'order-1',
        exchangeFillId: 'exchange-fill-2',
        tradeId: 'trade-2',
        side: 'buy',
        price: expect.anything(),
        quantity: expect.anything(),
        fee: expect.anything(),
        feeCurrency: 'USDT',
        filledAt: new Date('2026-04-29T00:01:00.000Z'),
        rawPayload: { okx: true },
      }),
      skipDuplicates: true,
    })
    expect(tx.gridFill.findUnique).toHaveBeenCalledWith({
      where: {
        gridRuntimeInstanceId_exchangeFillId: {
          gridRuntimeInstanceId: 'grid-1',
          exchangeFillId: 'exchange-fill-2',
        },
      },
    })
  })

  it('returns the existing fill when createMany skips a duplicate fill id', async () => {
    const existingFill = { id: 'fill-existing', exchangeFillId: 'exchange-fill-1' }
    const tx = {
      gridFill: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(existingFill),
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

    expect(result).toEqual({ fill: existingFill, newlyRecorded: false })
    expect(tx.gridFill.createMany).toHaveBeenCalledTimes(1)
    expect(tx.gridFill.findUnique).toHaveBeenCalledWith({
      where: {
        gridRuntimeInstanceId_exchangeFillId: {
          gridRuntimeInstanceId: 'grid-1',
          exchangeFillId: 'exchange-fill-1',
        },
      },
    })
  })

  it('updates instance status only when current status is allowed', async () => {
    const tx = {
      gridRuntimeInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    const transitioned = await repo.transitionInstanceStatus({
      id: 'grid-1',
      fromStatuses: ['CREATED'],
      toStatus: 'INITIALIZING',
    })

    expect(transitioned).toBe(true)
    expect(tx.gridRuntimeInstance.updateMany).toHaveBeenCalledWith({
      where: { id: 'grid-1', status: { in: ['CREATED'] } },
      data: { status: 'INITIALIZING' },
    })
  })

  it('preserves stop reason unless a transition explicitly supplies one', async () => {
    const tx = {
      gridRuntimeInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    await repo.transitionInstanceStatus({
      id: 'grid-1',
      fromStatuses: ['PAUSED'],
      toStatus: 'RUNNING',
      stopReason: null,
    })

    expect(tx.gridRuntimeInstance.updateMany).toHaveBeenCalledWith({
      where: { id: 'grid-1', status: { in: ['PAUSED'] } },
      data: { status: 'RUNNING', stopReason: null },
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

  it('updates status and appends event inside one transaction', async () => {
    const tx = {
      gridRuntimeInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      gridRuntimeEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    }
    const txHost = createTxHost(tx)
    const repo = new GridRuntimeRepository(txHost)

    const transitioned = await repo.transitionInstanceStatusWithEvent({
      id: 'grid-1',
      fromStatuses: ['CREATED'],
      toStatus: 'INITIALIZING',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_initializing',
        severity: 'info',
        status: 'INITIALIZING',
      },
    })

    expect(transitioned).toBe(true)
    expect(txHost.withTransaction).toHaveBeenCalledTimes(1)
    expect(tx.gridRuntimeInstance.updateMany).toHaveBeenCalledWith({
      where: { id: 'grid-1', status: { in: ['CREATED'] } },
      data: { status: 'INITIALIZING' },
    })
    expect(tx.gridRuntimeEvent.create).toHaveBeenCalledWith({
      data: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_initializing',
        severity: 'info',
        status: 'INITIALIZING',
        message: null,
        payload: undefined,
      },
    })
  })

  it('does not append an event when status transition CAS fails', async () => {
    const tx = {
      gridRuntimeInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      gridRuntimeEvent: {
        create: jest.fn(),
      },
    }
    const repo = new GridRuntimeRepository(createTxHost(tx))

    const transitioned = await repo.transitionInstanceStatusWithEvent({
      id: 'grid-1',
      fromStatuses: ['CREATED'],
      toStatus: 'INITIALIZING',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_initializing',
        severity: 'info',
        status: 'INITIALIZING',
      },
    })

    expect(transitioned).toBe(false)
    expect(tx.gridRuntimeEvent.create).not.toHaveBeenCalled()
  })
})
