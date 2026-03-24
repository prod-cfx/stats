import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import { describe, expect, it, jest } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server.node'
import type { ReactNode } from 'react'
import { AiQuantStrategyDetail } from './AiQuantStrategyDetail'
import { buildParamSummary } from './AiQuantStrategyList'

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
  default: ({ children, href }: { children: ReactNode, href: string }) => <a href={href}>{children}</a>,
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

function makeStrategy(overrides: Partial<AiQuantStrategyRecord> = {}): AiQuantStrategyRecord {
  return {
    id: 'stg-1',
    name: 'Test Strategy',
    status: 'running',
    exchange: 'binance',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    positionPct: 10,
    initialCapital: 10000,
    metrics: {
      returnPct: 10,
      maxDrawdownPct: 5,
      winRatePct: 60,
      tradeCount: 12,
    },
    equitySeries: [
      { ts: '2026-03-20 00:00', value: 10000 },
      { ts: '2026-03-20 01:00', value: 10020 },
    ],
    timeline: [{ at: '2026-03-20 01:00', event: 'Started' }],
    paramSchema: {
      type: 'object',
      properties: {
        leverage: { type: 'number', title: '杠杆' },
        atrPeriod: { type: 'number', title: 'ATR周期' },
        enableTrailing: { type: 'boolean', title: '移动止盈' },
      },
    },
    paramValues: {
      leverage: 3,
      atrPeriod: 14,
      enableTrailing: true,
    },
    schemaVersion: 'v1',
    supportsDynamicParams: true,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('AiQuant strategy dynamic params', () => {
  it('buildParamSummary returns dynamic schema-based summary entries', () => {
    const summary = buildParamSummary(
      {
        type: 'object',
        properties: {
          leverage: { type: 'number', title: '杠杆' },
          atrPeriod: { type: 'number', title: 'ATR周期' },
          enableTrailing: { type: 'boolean', title: '移动止盈' },
        },
      },
      {
        leverage: 3,
        atrPeriod: 14,
        enableTrailing: true,
      },
    )

    expect(summary).toEqual(['杠杆: 3', 'ATR周期: 14', '移动止盈: true'])
  })

  it('renders detail params from dynamic schema and values', () => {
    const html = renderToStaticMarkup(
      <AiQuantStrategyDetail
        lng="zh"
        strategy={makeStrategy()}
      />,
    )

    expect(html).toContain('参数快照')
    expect(html).toContain('杠杆：3')
    expect(html).toContain('ATR周期：14')
    expect(html).toContain('移动止盈：true')
  })

  it('shows legacy rejection when schema is missing and hides param panel', () => {
    const html = renderToStaticMarkup(
      <AiQuantStrategyDetail
        lng="zh"
        strategy={makeStrategy({
          supportsDynamicParams: false,
          paramSchema: null,
          paramValues: null,
        })}
      />,
    )

    expect(html).toContain('不支持旧策略，请重新生成')
    expect(html).not.toContain('参数快照')
    expect(html).not.toContain('杠杆：3')
  })
})
