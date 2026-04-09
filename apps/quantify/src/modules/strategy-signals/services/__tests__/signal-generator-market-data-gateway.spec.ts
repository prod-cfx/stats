import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
jest.mock('@/common/utils/prisma-enum-mappers', () => ({
  reverseMapTimeframe: (value: string) => value,
}))

import { SignalGeneratorService } from '../signal-generator.service'

describe('signal generator market-data gateway smoke', () => {
  const config: StrategySignalsRuntimeConfig = {
    enabled: true,
    cronExpression: '*/5 * * * *',
    cooldownMinutes: 15,
    batchSize: 10,
    maxSymbolsPerStrategy: 3,
    debug: {
      enabled: false,
      maxScriptLength: 1000,
      maxValueLength: 200,
    },
    ai: {
      maxAttempts: 2,
      temperature: 0.2,
      maxTokens: 400,
      maxFailuresBeforeCooldown: 3,
      failureCooldownMinutes: 30,
      maxRawResponseLength: 4000,
    },
    execution: {
      enabled: false,
      dryRun: true,
      maxAccountsPerSignal: 25,
      defaultQuoteAmount: 100,
      minBalanceThreshold: 50,
      maxRiskFraction: 0.2,
    },
  }

  const mockPrisma = {}
  const mockConfigService = {
    get: jest.fn().mockReturnValue(config),
  }
  const mockSchedulerRegistry = {
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
  }
  const mockAiService = {}
  const mockTradingSignalRepository = {}
  const mockStateRepository = {}
  const mockEventEmitter = {}
  const mockTelemetry = {}
  const mockGateway = {
    getRecentBarsBySymbolId: jest.fn(),
    getLatestBarBySymbolId: jest.fn(),
  }

  let service: SignalGeneratorService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})
    service = new SignalGeneratorService(
      mockPrisma as any,
      mockConfigService as any,
      mockSchedulerRegistry as any,
      mockAiService as any,
      mockTradingSignalRepository as any,
      mockStateRepository as any,
      mockEventEmitter as any,
      mockTelemetry as any,
      mockGateway as any,
      {} as any,
      {} as any,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('loads recent BTCUSDT 1h bars through gateway in ascending order', async () => {
    mockGateway.getRecentBarsBySymbolId.mockResolvedValue([
      { time: new Date('2026-03-17T10:00:00Z'), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, isFinal: true },
      { time: new Date('2026-03-17T11:00:00Z'), open: 1.5, high: 2.5, low: 1, close: 2, volume: 12, isFinal: true },
    ])

    const bars = await (service as any).loadRecentBars('symbol-1', '1h', 50)

    expect(mockGateway.getRecentBarsBySymbolId).toHaveBeenCalledWith('symbol-1', '1h', 50)
    expect(bars).toHaveLength(2)
    expect(bars.map((bar: any) => bar.time.toISOString())).toEqual([
      '2026-03-17T10:00:00.000Z',
      '2026-03-17T11:00:00.000Z',
    ])
  })

  it('drops the latest unfinished bar when bar-close evaluation requires a finalized latest bar', async () => {
    mockGateway.getRecentBarsBySymbolId.mockResolvedValue([
      {
        timestamp: 1,
        time: new Date('2026-04-09T10:00:00Z'),
        open: 1,
        high: 2,
        low: 1,
        close: 1.5,
        volume: 10,
        isFinal: true,
      },
      {
        timestamp: 2,
        time: new Date('2026-04-09T10:15:00Z'),
        open: 1.5,
        high: 2.2,
        low: 1.3,
        close: 2,
        volume: 11,
        isFinal: false,
      },
    ])

    const bars = await (service as any).loadRecentBars('symbol-1', '15m', 50, {
      requireFinalLatestBar: true,
    })

    expect(bars.map((bar: any) => bar.timestamp)).toEqual([1])
  })
})
