import { API_BASE_URL, unwrapApiResponse } from '@/lib/api-client'

export type BacktestJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface CreateBacktestJobPayload {
  symbols: string[]
  baseTimeframe: string
  stateTimeframes: string[]
  initialCash: number
  leverage: number
  execution: {
    slippageBps: number
    feeBps: number
    priceSource: 'open' | 'close' | 'mid'
  }
  strategy: {
    id: string
    protocolVersion: 'v1'
    scriptCode: string
    params: Record<string, unknown>
  }
  dataRange: {
    fromTs: number
    toTs: number
  }
  bars: unknown[]
}

export interface BacktestJob {
  id: string
  status: BacktestJobStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
}

export interface BacktestJobResult {
  summary: {
    netProfit: number
    netProfitPct: number
    maxDrawdownPct: number
    winRate: number
    profitFactor: number
    totalTrades: number
  }
}

type ErrorPayload = {
  message?: unknown
  error?: {
    message?: unknown
    args?: {
      reasonMessage?: unknown
    }
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as ErrorPayload
  if (typeof candidate.error?.args?.reasonMessage === 'string' && candidate.error.args.reasonMessage.trim()) {
    return candidate.error.args.reasonMessage
  }
  if (typeof candidate.error?.message === 'string' && candidate.error.message.trim()) {
    return candidate.error.message
  }
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
  }
  return fallback
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload, response.statusText || 'Request failed')
    throw new Error(`HTTP ${response.status}: ${message}`)
  }

  return unwrapApiResponse(payload as T | { data?: T; message?: string }) as T
}

export function createBacktestJob(payload: CreateBacktestJobPayload): Promise<BacktestJob> {
  return requestJson<BacktestJob>('/backtesting/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getBacktestJob(jobId: string): Promise<BacktestJob> {
  return requestJson<BacktestJob>(`/backtesting/jobs/${jobId}`, {
    method: 'GET',
  })
}

export function getBacktestJobResult(jobId: string): Promise<BacktestJobResult> {
  return requestJson<BacktestJobResult>(`/backtesting/jobs/${jobId}/result`, {
    method: 'GET',
  })
}
