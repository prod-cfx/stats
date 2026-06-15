jest.mock('@/modules/orderbook-config/services/orderbook-pair-config.service', () => ({
  OrderbookPairConfigService: class OrderbookPairConfigService {},
}))

jest.mock('@/modules/trades-config/services/trades-pair-config.service', () => ({
  TradesPairConfigService: class TradesPairConfigService {},
}))

import type { OrderbookWsAdapter } from './orderbook-ws-adapter'
import type { TradesWsAdapter } from './trades-ws-adapter'
import { OrderbookWsSyncManager } from './orderbook-ws-sync-manager.service'
import { TradesWsSyncManager } from './trades-ws-sync-manager.service'

function createConfigService() {
  return { get: jest.fn() }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

async function flushMicrotasks() {
  await Promise.resolve()
}

describe('ws sync manager shutdown lifecycle', () => {
  it('shuts down orderbook adapters and allows repeated shutdown', async () => {
    const adapter: OrderbookWsAdapter = {
      key: 'BINANCE.CEX.PERPETUAL',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }
    const manager = new OrderbookWsSyncManager(
      createConfigService() as never,
      { findEnabledConfigs: jest.fn() } as never,
      [adapter],
    )

    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()
    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()

    expect(adapter.shutdown).toHaveBeenCalledTimes(2)
  })

  it('shuts down trades adapters and allows repeated shutdown', async () => {
    const adapter: TradesWsAdapter = {
      key: 'binance-perp-trades',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }
    const manager = new TradesWsSyncManager(
      createConfigService() as never,
      [adapter],
      { findEnabledConfigs: jest.fn() } as never,
    )

    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()
    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()

    expect(adapter.shutdown).toHaveBeenCalledTimes(2)
  })

  it('waits for an in-flight orderbook tick before shutting down adapters', async () => {
    const configs = createDeferred<[]>()
    const adapter: OrderbookWsAdapter = {
      key: 'BINANCE.CEX.PERPETUAL',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }
    const manager = new OrderbookWsSyncManager(
      createConfigService() as never,
      { findEnabledConfigs: jest.fn(() => configs.promise) } as never,
      [adapter],
    )

    const tick = (manager as unknown as { tick: () => Promise<void> }).tick()
    await flushMicrotasks()
    const shutdown = manager.onApplicationShutdown()
    await flushMicrotasks()

    expect(adapter.shutdown).not.toHaveBeenCalled()

    configs.resolve([])
    await tick
    await shutdown

    expect(adapter.ensureConnected).not.toHaveBeenCalled()
    expect(adapter.shutdown).toHaveBeenCalledTimes(1)
  })

  it('waits for an in-flight trades tick before shutting down adapters', async () => {
    const configs = createDeferred<[]>()
    const adapter: TradesWsAdapter = {
      key: 'binance-perp-trades',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }
    const manager = new TradesWsSyncManager(
      createConfigService() as never,
      [adapter],
      { findEnabledConfigs: jest.fn(() => configs.promise) } as never,
    )

    const tick = (manager as unknown as { tick: () => Promise<void> }).tick()
    await flushMicrotasks()
    const shutdown = manager.onApplicationShutdown()
    await flushMicrotasks()

    expect(adapter.shutdown).not.toHaveBeenCalled()

    configs.resolve([])
    await tick
    await shutdown

    expect(adapter.ensureConnected).not.toHaveBeenCalled()
    expect(adapter.shutdown).toHaveBeenCalledTimes(1)
  })

  it('logs orderbook adapter shutdown failures without rejecting application shutdown', async () => {
    const adapter: OrderbookWsAdapter = {
      key: 'BINANCE.CEX.PERPETUAL',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockRejectedValue(new Error('close failed')),
    }
    const manager = new OrderbookWsSyncManager(
      createConfigService() as never,
      { findEnabledConfigs: jest.fn() } as never,
      [adapter],
    )
    const logger = jest.spyOn((manager as unknown as { logger: { error: (message: string) => void } }).logger, 'error')

    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()

    expect(logger).toHaveBeenCalledWith('Orderbook WS adapter shutdown failed for key=BINANCE.CEX.PERPETUAL: close failed')
  })

  it('logs trades adapter shutdown failures without rejecting application shutdown', async () => {
    const adapter: TradesWsAdapter = {
      key: 'binance-perp-trades',
      ensureConnected: jest.fn(),
      syncTargetConfigs: jest.fn(),
      shutdown: jest.fn().mockRejectedValue(new Error('close failed')),
    }
    const manager = new TradesWsSyncManager(
      createConfigService() as never,
      [adapter],
      { findEnabledConfigs: jest.fn() } as never,
    )
    const logger = jest.spyOn((manager as unknown as { logger: { error: (message: string) => void } }).logger, 'error')

    await expect(manager.onApplicationShutdown()).resolves.toBeUndefined()

    expect(logger).toHaveBeenCalledWith('Trades WS adapter shutdown failed for key=binance-perp-trades: close failed')
  })
})
