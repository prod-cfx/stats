export type StrategyStatus = 'running' | 'stopped' | 'draft'

export interface StrategyMetricSnapshot {
  returnPct: number
  maxDrawdownPct: number
  winRatePct: number
  tradeCount: number
}

export interface StrategyEquityPoint {
  ts: string
  value: number
}

export interface StrategyTimelineEvent {
  at: string
  event: string
  note?: string
}

export interface AiQuantStrategyRecord {
  id: string
  name: string
  status: StrategyStatus
  exchange: 'binance' | 'okx'
  symbol: string
  timeframe: string
  positionPct: number
  initialCapital: number
  metrics: StrategyMetricSnapshot
  equitySeries: StrategyEquityPoint[]
  timeline: StrategyTimelineEvent[]
  deploy?: {
    exchange: 'binance' | 'okx'
    accountId: string
    accountName: string
    at: string
    status: 'running' | 'stopped'
  }
  updatedAt: string
}

const STORAGE_KEY = 'ai_quant_strategy_store_v1'

function formatTs(date: Date) {
  const y = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${mm}-${dd} ${hh}:${min}`
}

function makeEquity(seed: number) {
  const base = 100
  const now = new Date()
  return Array.from({ length: 24 }).map((_, idx) => {
    const drift = (seed % 7) * 0.15
    const wave = Math.sin((idx + seed) / 3) * 1.6
    const trend = idx * drift
    const ts = new Date(now.getTime() - (23 - idx) * 60 * 60 * 1000)
    return {
      ts: formatTs(ts),
      value: Number((base + trend + wave).toFixed(2)),
    }
  })
}

function seedStrategies(): AiQuantStrategyRecord[] {
  const now = Date.now()
  return [
    {
      id: 'stg-momentum-btc',
      name: 'BTC Momentum Breakout',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '3m/15m',
      positionPct: 10,
      initialCapital: 10000,
      metrics: { returnPct: 21.8, maxDrawdownPct: 12.3, winRatePct: 58.4, tradeCount: 74 },
      equitySeries: makeEquity(1),
      timeline: [
        { at: '2026-03-01 09:12', event: 'Strategy Created', note: 'From AI Template' },
        { at: '2026-03-01 09:20', event: 'Backtest Passed', note: 'Max Drawdown 12.3%' },
        { at: '2026-03-01 09:25', event: 'Deployed', note: 'Connected Binance' },
        { at: '2026-03-01 09:26', event: 'Started' },
      ],
      updatedAt: new Date(now - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'stg-grid-btc-okx',
      name: 'BTC Grid Range',
      status: 'stopped',
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 12,
      initialCapital: 10000,
      metrics: { returnPct: 8.6, maxDrawdownPct: 18.2, winRatePct: 62.7, tradeCount: 128 },
      equitySeries: makeEquity(2),
      timeline: [
        { at: '2026-02-27 10:05', event: 'Strategy Created' },
        { at: '2026-02-27 10:17', event: 'Backtest Passed', note: 'Max Drawdown 18.2%' },
        { at: '2026-02-27 10:20', event: 'Deployed' },
        { at: '2026-03-03 18:30', event: 'Stopped', note: 'User Manual Stop' },
      ],
      updatedAt: new Date(now - 1000 * 60 * 90).toISOString(),
    },
    {
      id: 'stg-boll-mean-rev',
      name: 'Bollinger Mean Reversion',
      status: 'draft',
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 8,
      initialCapital: 10000,
      metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
      equitySeries: makeEquity(3),
      timeline: [
        { at: '2026-03-04 08:40', event: 'Strategy Created', note: 'Pending Backtest' },
      ],
      updatedAt: new Date(now - 1000 * 60 * 220).toISOString(),
    },
    {
      id: 'stg-eth-dip-buy',
      name: 'ETH Dip Buy',
      status: 'running',
      exchange: 'binance',
      symbol: 'ETHUSDT',
      timeframe: '15m/30m',
      positionPct: 10,
      initialCapital: 10000,
      metrics: { returnPct: 14.2, maxDrawdownPct: 16.4, winRatePct: 54.9, tradeCount: 49 },
      equitySeries: makeEquity(4),
      timeline: [
        { at: '2026-03-02 14:10', event: 'Strategy Created' },
        { at: '2026-03-02 14:18', event: 'Backtest Passed', note: 'Max Drawdown 16.4%' },
        { at: '2026-03-02 14:20', event: 'Deployed' },
        { at: '2026-03-02 14:21', event: 'Started' },
      ],
      updatedAt: new Date(now - 1000 * 60 * 35).toISOString(),
    },
  ]
}

function isLegacyTs(ts: string) {
  return /^T\d+$/i.test(ts)
}

function migrateRecord(record: AiQuantStrategyRecord, seed: number): AiQuantStrategyRecord {
  const nextSeries = record.equitySeries.some(point => isLegacyTs(point.ts))
    ? makeEquity(seed).map((item, idx) => ({ ...item, value: record.equitySeries[idx]?.value ?? item.value }))
    : record.equitySeries

  return {
    ...record,
    initialCapital: record.initialCapital || 10000,
    equitySeries: nextSeries,
  }
}

export function ensureStrategyStore() {
  if (typeof window === 'undefined') return seedStrategies()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = seedStrategies()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }

  try {
    const parsed = JSON.parse(raw) as AiQuantStrategyRecord[]
    if (!Array.isArray(parsed)) throw new Error('invalid')
    const migrated = parsed.map((item, idx) => migrateRecord(item, idx + 1))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    const seeded = seedStrategies()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }
}

export function listStrategies() {
  return ensureStrategyStore().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getStrategyById(id: string) {
  return ensureStrategyStore().find(item => item.id === id) ?? null
}

export function upsertStrategyDeployment(input: {
  id: string
  name: string
  exchange: 'binance' | 'okx'
  symbol: string
  timeframe: string
  positionPct: number
  accountId: string
  accountName: string
  metrics: StrategyMetricSnapshot
}) {
  const now = new Date().toISOString()
  const existing = ensureStrategyStore()
  const target = existing.find(item => item.id === input.id)
  const next: AiQuantStrategyRecord[] = target
    ? existing.map(item => (item.id === input.id
      ? {
          ...item,
          name: input.name,
          exchange: input.exchange,
          symbol: input.symbol,
          timeframe: input.timeframe,
          positionPct: input.positionPct,
          initialCapital: item.initialCapital || 10000,
          metrics: input.metrics,
          status: 'running',
          deploy: {
            exchange: input.exchange,
            accountId: input.accountId,
            accountName: input.accountName,
            at: now,
            status: 'running',
          },
          timeline: [
            ...item.timeline,
            { at: now.replace('T', ' ').slice(0, 16), event: '一键部署', note: `${input.exchange.toUpperCase()} / ${input.accountName}` },
            { at: now.replace('T', ' ').slice(0, 16), event: '开始运行' },
          ],
          updatedAt: now,
        }
      : item))
    : [
        {
          id: input.id,
          name: input.name,
          status: 'running',
          exchange: input.exchange,
          symbol: input.symbol,
          timeframe: input.timeframe,
          positionPct: input.positionPct,
          initialCapital: 10000,
          metrics: input.metrics,
          equitySeries: makeEquity(Date.now() % 10),
          timeline: [
            { at: now.replace('T', ' ').slice(0, 16), event: '创建策略' },
            { at: now.replace('T', ' ').slice(0, 16), event: '回测通过', note: `最大回撤 ${input.metrics.maxDrawdownPct}%` },
            { at: now.replace('T', ' ').slice(0, 16), event: '一键部署', note: `${input.exchange.toUpperCase()} / ${input.accountName}` },
            { at: now.replace('T', ' ').slice(0, 16), event: '开始运行' },
          ],
          deploy: {
            exchange: input.exchange,
            accountId: input.accountId,
            accountName: input.accountName,
            at: now,
            status: 'running',
          },
          updatedAt: now,
        },
        ...existing,
      ]

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function updateStrategyStatus(id: string, status: StrategyStatus) {
  const now = new Date().toISOString()
  const existing = ensureStrategyStore()
  const next = existing.map(item => {
    if (item.id !== id) return item
    
    const event = status === 'running' ? '开始运行' : '停止运行'
    const note = status === 'running' ? '用户手动启动' : '用户手动停止'
    
    return {
      ...item,
      status,
      timeline: [
        ...item.timeline,
        { at: now.replace('T', ' ').slice(0, 16), event, note },
      ],
      updatedAt: now,
    }
  })
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
