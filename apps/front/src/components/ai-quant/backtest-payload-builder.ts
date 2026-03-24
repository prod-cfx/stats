import type { CreateBacktestJobPayload } from './backtest-job-client'
import type { BacktestRangeInput } from './backtest-range'
import { resolveBacktestRange, validateBacktestRange } from './backtest-range'

export interface BuildBacktestPayloadInput {
  symbol: string
  baseTimeframe: string
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
}

export function buildBacktestPayload(
  input: BuildBacktestPayloadInput,
  now = new Date(),
): CreateBacktestJobPayload {
  const symbol = input.symbol.trim()
  if (!symbol) {
    throw new Error('missing_symbol')
  }

  const scriptCode = input.strategy.scriptCode.trim()
  if (!scriptCode) {
    throw new Error('missing_script_code')
  }

  const validation = validateBacktestRange(input.range)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const resolvedRange = resolveBacktestRange(input.range, now)

  return {
    symbols: [symbol],
    baseTimeframe: input.baseTimeframe,
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
    bars: [],
  }
}
