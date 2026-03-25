import type { CreateBacktestJobPayload } from './backtest-job-client'
import type { BacktestRangeInput } from './backtest-range'
import { resolveBacktestRange, validateBacktestRange } from './backtest-range'

export type BacktestPayloadBuilderErrorCode =
  | 'missing_symbol'
  | 'missing_script_code'
  | 'missing_range'
  | 'start_after_end'
  | 'range_too_large'
  | 'symbol_not_allowed'
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
  symbol: string
  baseTimeframe: string
  capabilities: {
    allowedSymbols: string[]
    allowedBaseTimeframes: string[]
  }
  stateTimeframes: string[]
  initialCash: number
  leverage: number
  execution: CreateBacktestJobPayload['execution']
  strategy: {
    id: string
    scriptCode: string
    params: Record<string, unknown>
  }
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
  if (!input.capabilities.allowedSymbols.includes(symbol)) {
    throw new BacktestPayloadBuilderError('symbol_not_allowed')
  }

  const baseTimeframe = input.baseTimeframe.trim()
  if (!input.capabilities.allowedBaseTimeframes.includes(baseTimeframe)) {
    throw new BacktestPayloadBuilderError('timeframe_not_allowed')
  }

  const scriptCode = input.strategy.scriptCode.trim()
  if (!scriptCode) {
    throw new BacktestPayloadBuilderError('missing_script_code')
  }

  const validation = validateBacktestRange(input.range)
  if (!validation.ok) {
    throw new BacktestPayloadBuilderError(validation.reason)
  }

  const resolvedRange = resolveBacktestRange(input.range, now)

  const payload: CreateBacktestJobPayload = {
    symbols: [symbol],
    baseTimeframe,
    stateTimeframes: input.stateTimeframes,
    initialCash: input.initialCash,
    leverage: input.leverage,
    execution: input.execution,
    strategy: {
      id: input.strategy.id,
      protocolVersion: 'v1',
      scriptCode,
      params: input.strategy.params,
    },
    dataRange: {
      fromTs: Date.parse(resolvedRange.startAt),
      toTs: Date.parse(resolvedRange.endAt),
    },
  }

  if (input.allowPartial === true) {
    payload.allowPartial = true
  }

  return payload
}
