import type { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
import type { PrismaService } from '@/prisma/prisma.service'
import { LlmV3ToolsExecutor } from '../llm-v3-tools.executor'

describe('llm v3 tools executor gateway integration', () => {
  const mockPrisma = {
    getClient: jest.fn(),
  }

  const mockGateway = {
    getRecentBars: jest.fn(),
  }

  let executor: LlmV3ToolsExecutor

  beforeEach(() => {
    jest.clearAllMocks()
    executor = new LlmV3ToolsExecutor(
      mockPrisma as unknown as PrismaService,
      mockGateway as unknown as MarketDataReadGateway,
    )
  })

  it('getMarketDataRaw uses gateway', async () => {
    mockPrisma.getClient.mockReturnValue({
      symbol: {
        findUnique: jest.fn().mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' }),
      },
    })
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
      strategyInstanceId: 'instance-1',
      allowedSymbols: ['BTCUSDT'],
      allowedTimeframes: ['1h'],
      dataContextCache: new Map(),
    }
    const typedContext = context as Parameters<LlmV3ToolsExecutor['getMarketDataRaw']>[1]

    const result = await executor.getMarketDataRaw(
      { symbol: 'BTCUSDT', timeframe: '1h', lookbackBars: 50 },
      typedContext,
    )

    expect(mockGateway.getRecentBars).toHaveBeenCalledWith('BTCUSDT', '1h', 50)
    const timestamps = result.bars.map(bar => bar.timestamp)
    expect(timestamps.every((ts, index) => index === 0 || ts > timestamps[index - 1]!)).toBe(true)
  })
})
