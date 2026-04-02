import { postBacktestSymbolSupportCheck } from '@/lib/api'
import { ApiError } from '@/lib/errors'

export type BacktestSymbolSupportStatus = 'supported' | 'refreshed_then_supported' | 'not_supported'

export interface BacktestSymbolSupportResult {
  status: BacktestSymbolSupportStatus
}

export interface CheckBacktestSymbolSupportInput {
  exchange: string
  symbol: string
}

function isSupportedStatus(value: unknown): value is BacktestSymbolSupportStatus {
  return value === 'supported' || value === 'refreshed_then_supported' || value === 'not_supported'
}

function parseSupportResult(payload: unknown): BacktestSymbolSupportResult {
  if (!payload || typeof payload !== 'object' || !isSupportedStatus((payload as { status?: unknown }).status)) {
    throw new ApiError('Invalid symbol support payload', 'API_ERROR', 500, payload)
  }
  return { status: (payload as { status: BacktestSymbolSupportStatus }).status }
}

export async function checkBacktestSymbolSupport(
  input: CheckBacktestSymbolSupportInput,
): Promise<BacktestSymbolSupportResult> {
  const payload = await postBacktestSymbolSupportCheck(input)
  return parseSupportResult(payload)
}
