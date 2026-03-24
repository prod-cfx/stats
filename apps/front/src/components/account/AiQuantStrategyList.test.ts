import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import { describe, expect, it, jest } from '@jest/globals'
import { buildParamSummary, buildPrimarySummary } from './AiQuantStrategyList'

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

  it('uses fixed summary path when schema is missing', () => {
    const record = makeListRecord({
      paramSchema: null,
      paramValues: null,
    })
    const out = buildPrimarySummary(record, key => key)

    expect(out.isDynamic).toBe(false)
    expect(out.entries).toEqual([
      'BINANCE',
      'BTCUSDT',
      '15m',
      'aiQuant.position 10%',
    ])
  })

  it('caps dynamic summary at 3 items and filters invalid values', () => {
    const summary = buildParamSummary(
      {
        type: 'object',
        properties: {
          emptyString: { type: 'string', title: '空字符串' },
          zero: { type: 'number', title: '零值' },
          falseFlag: { type: 'boolean', title: '开关' },
          nullField: { type: 'string', title: '空值' },
          arrayField: { type: 'array', title: '数组' },
          objField: { type: 'object', title: '对象' },
          extra: { type: 'string', title: '额外' },
        },
      },
      {
        emptyString: '',
        zero: 0,
        falseFlag: false,
        nullField: null,
        arrayField: ['a', 1, true, { bad: 'x' }],
        objField: { bad: 'x' },
        extra: 'ignored-by-limit',
      },
    )

    expect(summary).toEqual([
      '零值: 0',
      '开关: false',
      '数组: a, 1, true',
    ])
  })

  it('uses localized fallback when schema exists but dynamic summary is empty', () => {
    const record = makeListRecord({
      paramValues: {},
    })
    const out = buildPrimarySummary(record, key => (key === 'aiQuant.paramSummaryEmpty' ? '暂无参数' : key))

    expect(out.isDynamic).toBe(true)
    expect(out.entries).toEqual(['暂无参数'])
  })
})
