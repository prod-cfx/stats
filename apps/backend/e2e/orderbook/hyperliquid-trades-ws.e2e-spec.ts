import type { INestApplication } from '@nestjs/common'
import type { TradesConfig } from '@/modules/data-sync/services/trades-ws-adapter'
import { firstValueFrom, take, timeout } from 'rxjs'
import { HyperliquidDexPerpetualTradesWsAdapter } from '@/modules/data-sync/services/adapters/hyperliquid-dex-perpetual-trades-ws.adapter'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

const E2E_ENABLED = process.env.HYPERLIQUID_TRADES_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

interface HyperliquidWsTradeFixture {
  coin?: string
  px?: string
  sz?: string
  side?: string
  time?: number
  tid?: string
  users?: string[]
}

describeIf('Hyperliquid trades WS + SSE (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let tradesAdapter: HyperliquidDexPerpetualTradesWsAdapter
  const createdWhaleAddresses = new Set<string>()

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { HYPERLIQUID_TRADES_WS_ENABLED: 'true' },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    tradesAdapter = app.get(HyperliquidDexPerpetualTradesWsAdapter)
  })

  afterAll(async () => {
    if (prisma && createdWhaleAddresses.size > 0) {
      await prisma.hyperliquidWhaleAlert.deleteMany({
        where: {
          source: 'E2E',
          userAddress: { in: [...createdWhaleAddresses] },
        },
      })
    }
    if (app) {
      await app.close()
    }
  })

  it('should establish Hyperliquid trades WS and subscribe BTC trades', async () => {
    const config: TradesConfig = {
      exchange: 'HYPERLIQUID',
      instrumentType: 'PERPETUAL',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      enabled: true,
      priority: 100,
    }

    await tradesAdapter.ensureConnected()
    await waitForCondition(() => getAdapterOpen(tradesAdapter), 8_000)
    await tradesAdapter.syncTargetConfigs([config])

    const subscribed = getSubscribedCoins(tradesAdapter)
    expect(subscribed?.has('BTC')).toBe(true)
  })

  it('should filter whale trades and emit stream event', async () => {
    const whaleAddress = '0xwhalee2e00000000000000000000000000000001'

    await prisma.hyperliquidWhaleAlert.create({
      data: {
        userAddress: whaleAddress,
        symbol: 'BTC',
        positionSize: '1',
        entryPrice: '50000',
        liquidationPrice: '40000',
        positionValueUsd: '50000',
        positionAction: 1,
        createTime: new Date(),
        source: 'E2E',
      },
    })
    createdWhaleAddresses.add(whaleAddress)

    await tradesAdapter.refreshWhaleList()

    const tradesFixture: HyperliquidWsTradeFixture[] = [
      {
        coin: 'BTC',
        px: '65000',
        sz: '0.25',
        side: 'buy',
        time: Date.now(),
        tid: 'e2e-trade-1',
        users: [whaleAddress, '0xother000000000000000000000000000000000001'],
      },
      {
        coin: 'BTC',
        px: '65000',
        sz: '0.15',
        side: 'sell',
        time: Date.now(),
        tid: 'e2e-trade-2',
        users: ['0xnope000000000000000000000000000000000001', '0xnope000000000000000000000000000000000002'],
      },
    ]

    const eventPromise = firstValueFrom(
      tradesAdapter.getTradesStream().pipe(
        take(1),
        timeout({ first: 2_000 }),
      ),
    )

    invokeHandleTradesMessage(tradesAdapter, tradesFixture)
    const event = await eventPromise

    expect(event.whaleAddress).toBe(whaleAddress.toLowerCase())
    expect(event.coin).toBe('BTC')
    expect(event.tradeId).toBe('e2e-trade-1')
  })

  it('should push SSE events for whale trades', async () => {
    const whaleAddress = '0xwhalee2e00000000000000000000000000000002'

    await prisma.hyperliquidWhaleAlert.create({
      data: {
        userAddress: whaleAddress,
        symbol: 'BTC',
        positionSize: '1',
        entryPrice: '50000',
        liquidationPrice: '40000',
        positionValueUsd: '50000',
        positionAction: 1,
        createTime: new Date(),
        source: 'E2E',
      },
    })
    createdWhaleAddresses.add(whaleAddress)

    await tradesAdapter.refreshWhaleList()

    const server = app.getHttpServer()
    if (!server.listening) {
      await app.listen(0)
    }

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve HTTP server address')
    }

    const url = `http://127.0.0.1:${address.port}/whale-alerts/realtime-stream`
    const abortController = new AbortController()

    const ssePromise = readNextSseData(url, abortController.signal)

    const trade: HyperliquidWsTradeFixture = {
      coin: 'BTC',
      px: '66000',
      sz: '0.4',
      side: 'buy',
      time: Date.now(),
      tid: 'e2e-trade-3',
      users: [whaleAddress, '0xother000000000000000000000000000000000003'],
    }

    invokeHandleTradesMessage(tradesAdapter, [trade])

    const raw = await ssePromise
    abortController.abort()

    const parsed = JSON.parse(raw) as {
      user_address: string
      symbol: string
      position_action: number
      side: string
    }

    expect(parsed.user_address).toBe(whaleAddress.toLowerCase())
    expect(parsed.symbol).toBe('BTC')
    expect(parsed.position_action).toBe(1)
    expect(parsed.side).toBe('Long')
  })
})

function getSubscribedCoins(
  adapter: HyperliquidDexPerpetualTradesWsAdapter,
): Set<string> | null {
  const state = adapter as unknown as { subscribedCoins?: Set<string> }
  return state.subscribedCoins ?? null
}

function getAdapterOpen(adapter: HyperliquidDexPerpetualTradesWsAdapter): boolean {
  const state = adapter as unknown as { open?: boolean }
  return state.open === true
}

function invokeHandleTradesMessage(
  adapter: HyperliquidDexPerpetualTradesWsAdapter,
  trades: HyperliquidWsTradeFixture[],
): void {
  const state = adapter as unknown as {
    handleTradesMessage: (payload: HyperliquidWsTradeFixture[]) => void
  }
  state.handleTradesMessage(trades)
}

async function waitForCondition(check: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Condition not met before timeout')
}

async function readNextSseData(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/event-stream',
    },
    signal,
  })

  if (!response.body) {
    throw new Error('SSE response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = Date.now() + 5_000

  while (Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data.startsWith(':')) continue
      return data
    }
  }

  throw new Error('Timed out waiting for SSE data')
}
