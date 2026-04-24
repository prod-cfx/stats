import type { CreateBacktestJobPayload } from './backtest-job-client'
import type { BacktestRangeInput } from './backtest-range'
import { resolveBacktestRange, validateBacktestRange } from './backtest-range'

export type BacktestPayloadBuilderErrorCode =
  | 'missing_symbol'
  | 'missing_published_snapshot'
  | 'invalid_execution_config'
  | 'missing_range'
  | 'start_after_end'
  | 'range_too_large'
  | 'timeframe_not_allowed'

export class BacktestPayloadBuilderError extends Error {
  constructor(public readonly code: BacktestPayloadBuilderErrorCode) {
    super(code)
    this.name = 'BacktestPayloadBuilderError'
  }
}

export function isBacktestPayloadBuilderError(error: unknown): error is BacktestPayloadBuilderError {
  return error instanceof BacktestPayloadBuilderError
}

export interface BuildBacktestPayloadInput {
  marketType: 'spot' | 'perp'
  symbol: string
  baseTimeframe: string
  capabilities: {
    allowedBaseTimeframes: string[]
  }
  stateTimeframes: string[]
  initialCash: number
  leverage: number | null
  execution: CreateBacktestJobPayload['execution']
  strategy: {
    id: string
    publishedSnapshotId: string
  }
  conversationId?: string
  range: BacktestRangeInput
  allowPartial?: boolean
}

export function buildBacktestPayload(
  input: BuildBacktestPayloadInput,
  now = new Date(),
): CreateBacktestJobPayload {
  const symbol = input.symbol.trim()
  if (!symbol) {
    throw new BacktestPayloadBuilderError('missing_symbol')
  }

  const baseTimeframe = input.baseTimeframe.trim()
  if (!input.capabilities.allowedBaseTimeframes.includes(baseTimeframe)) {
    throw new BacktestPayloadBuilderError('timeframe_not_allowed')
  }

  const publishedSnapshotId = input.strategy.publishedSnapshotId.trim()
  if (!publishedSnapshotId) {
    throw new BacktestPayloadBuilderError('missing_published_snapshot')
  }

  const initialCash = input.initialCash
  const leverage = input.leverage
  const slippageBps = input.execution?.slippageBps
  const feeBps = input.execution?.feeBps
  const priceSource = input.execution?.priceSource
  if (
    !Number.isFinite(initialCash) || initialCash <= 0 ||
    !Number.isFinite(slippageBps) || slippageBps < 0 ||
    !Number.isFinite(feeBps) || feeBps < 0 ||
    (priceSource !== 'open' && priceSource !== 'close' && priceSource !== 'mid')
  ) {
    throw new BacktestPayloadBuilderError('invalid_execution_config')
  }
  if (input.marketType === 'perp' && (!Number.isFinite(leverage) || (leverage ?? 0) <= 0)) {
    throw new BacktestPayloadBuilderError('invalid_execution_config')
  }

  const validation = validateBacktestRange(input.range)
  if (!validation.ok) {
    throw new BacktestPayloadBuilderError(validation.reason)
  }

  const resolvedRange = resolveBacktestRange(input.range, now, baseTimeframe)
  const resolvedFromTs = Date.parse(resolvedRange.startAt)
  const resolvedToTs = Date.parse(resolvedRange.endAt)
  if (resolvedFromTs >= resolvedToTs) {
    throw new BacktestPayloadBuilderError('start_after_end')
  }

  const payload: CreateBacktestJobPayload = {
    symbols: [symbol],
    baseTimeframe,
    stateTimeframes: input.stateTimeframes,
    initialCash,
    execution: input.execution,
    strategy: {
      id: input.strategy.id,
      protocolVersion: 'v1',
      publishedSnapshotId,
      params: { marketType: input.marketType },
    },
    ...(input.conversationId?.trim() ? { conversationId: input.conversationId.trim() } : {}),
    dataRange: {
      fromTs: resolvedFromTs,
      toTs: resolvedToTs,
    },
    requestedRangeInput:
      input.range.preset === 'CUSTOM'
        ? {
            preset: 'CUSTOM',
            startAt: input.range.startAt,
            endAt: input.range.endAt,
          }
        : { preset: input.range.preset },
  }
  if (input.marketType === 'perp') {
    payload.leverage = leverage as number
  }

  if (input.allowPartial === true) {
    payload.allowPartial = true
  }

  return payload
}
