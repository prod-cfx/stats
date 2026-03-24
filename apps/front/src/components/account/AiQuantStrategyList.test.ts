import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import { describe, expect, it, jest } from '@jest/globals'
import { buildPrimarySummary } from './AiQuantStrategyList'

jest.mock('lucide-react', () => ({
  Activity: () => null,
  Clock: () => null,
  MoreHorizontal: () => null,
  Play: () => null,
  PlayCircle: () => null,
  Square: () => null,
  StopCircle: () => null,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: null }),
}))

jest.mock('@/lib/api', () => ({
  fetchAccountAiQuantStrategies: async () => ({ items: [] }),
  performAccountAiQuantStrategyAction: async () => undefined,
}))

function makeListRecord(overrides: Partial<AiQuantStrategyRecord> = {}): AiQuantStrategyRecord {
  return {
    id: 'stg-list-1',
    name: 'List Strategy',
    status: 'running',
    exchange: 'binance',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    positionPct: 10,
    initialCapital: 10000,
    metrics: {
      returnPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    },
    equitySeries: [],
    timeline: [],
    paramSchema: {
      type: 'object',
      properties: {
        leverage: { type: 'number', title: '杠杆' },
        atrPeriod: { type: 'number', title: 'ATR周期' },
      },
    },
    paramValues: {
      leverage: 3,
      atrPeriod: 14,
    },
    schemaVersion: 'v1',
    supportsDynamicParams: false,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('AiQuantStrategyList primary summary', () => {
  it('uses dynamic summary path when schema exists and does not use fixed primary summary', () => {
    const record = makeListRecord()
    const out = buildPrimarySummary(record, key => key)

    expect(out.isDynamic).toBe(true)
    expect(out.entries).toEqual(['杠杆: 3', 'ATR周期: 14'])
    expect(out.entries).not.toContain(record.exchange.toUpperCase())
    expect(out.entries).not.toContain(record.symbol)
    expect(out.entries).not.toContain(record.timeframe)
    expect(out.entries).not.toContain(`aiQuant.position ${record.positionPct}%`)
  })
})
