import type { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
import { LlmV3ToolsExecutor } from '../llm-v3-tools.executor'

describe('llm v3 tools executor gateway integration', () => {
  const mockClient = {
    symbol: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    llmStrategyInstance: { findUnique: jest.fn() },
    strategyInstance: { findUnique: jest.fn() },
  }

  const mockTxHost = {
    get tx() { return mockClient },
  }

  const mockGateway = {
    getRecentBars: jest.fn(),
  }

  let executor: LlmV3ToolsExecutor

  beforeEach(() => {
    jest.clearAllMocks()
    executor = new LlmV3ToolsExecutor(
      mockTxHost as any,
      mockGateway as unknown as MarketDataReadGateway,
    )
  })

  it('getMarketDataRaw uses gateway', async () => {
    mockClient.symbol.findUnique.mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' })
    mockGateway.getRecentBars.mockResolvedValue([
      {
        timestamp: 1000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
      },
      {
        timestamp: 2000,
        open: 1.5,
        high: 2.5,
        low: 1,
        close: 2,
        volume: 12,
      },
    ])

    const context = {
      strategyInstanceId: 'inst-1',
      allowedSymbols: ['BTCUSDT'],
      allowedTimeframes: ['1h'],
    }

    const result = await (executor as any).getMarketDataRaw(
      {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        limit: 10,
      },
      context,
    )

    expect(mockGateway.getRecentBars).toHaveBeenCalled()
    expect(result.bars.length).toBe(2)
  })
})
