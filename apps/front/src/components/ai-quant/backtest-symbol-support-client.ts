import { postBacktestSymbolSupportCheck } from '@/lib/api'
import { ApiError } from '@/lib/errors'

export type BacktestSymbolSupportStatus = 'supported' | 'refreshed_then_supported' | 'not_supported'

export interface BacktestSymbolSupportResult {
  status: BacktestSymbolSupportStatus
  reasonCode?: string
  args?: Record<string, unknown>
}

export interface CheckBacktestSymbolSupportInput {
  exchange: string
  marketType?: 'spot' | 'perp'
  symbol: string
  baseTimeframe?: string
}

function isSupportedStatus(value: unknown): value is BacktestSymbolSupportStatus {
  return value === 'supported' || value === 'refreshed_then_supported' || value === 'not_supported'
}

function parseSupportResult(payload: unknown): BacktestSymbolSupportResult {
  if (!payload || typeof payload !== 'object' || !isSupportedStatus((payload as { status?: unknown }).status)) {
    throw new ApiError('Invalid symbol support payload', 'API_ERROR', 500, payload)
  }

  const candidate = payload as {
    status: BacktestSymbolSupportStatus
    reasonCode?: unknown
    args?: unknown
  }
  const reasonCode = typeof candidate.reasonCode === 'string' ? candidate.reasonCode : undefined
  const args = candidate.args && typeof candidate.args === 'object'
    ? candidate.args as Record<string, unknown>
    : undefined

  return {
    status: candidate.status,
    ...(reasonCode ? { reasonCode } : {}),
    ...(args ? { args } : {}),
  }
}

export async function checkBacktestSymbolSupport(
  input: CheckBacktestSymbolSupportInput,
): Promise<BacktestSymbolSupportResult> {
  const payload = await postBacktestSymbolSupportCheck(input)
  return parseSupportResult(payload)
}
