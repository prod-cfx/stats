import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface OptimizerBar {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OptimizerTrade {
  entryTs: number
  exitTs: number
  entryPrice: number
  exitPrice: number
  pnlPct: number
}

export interface OptimizerEquityPoint {
  ts: number
  equity: number
}

export interface OptimizerMetrics {
  winRate: number
  maxDrawdownPct: number
  totalReturnPct: number
  tradeCount: number
}

export interface TemplateOptimizationCandidate {
  templateId: string
  params: Record<string, number | string | boolean>
  metrics: OptimizerMetrics
}

interface MovingAverageLongOnlyParams {
  fastPeriod: number
  slowPeriod: number
  stopLossPct: number
  takeProfitPct: number
  positionPct: number
}

interface SimulationResult {
  equityCurve: OptimizerEquityPoint[]
  trades: OptimizerTrade[]
  metrics: OptimizerMetrics
}

interface AdmissionRule {
  maxDrawdownPctCeiling: number
  minWinRate: number
  minTradeCount: number
  minTotalReturnPct: number
}

interface TemplateSearchSpec {
  templateId: string
  exchange: 'okx' | 'binance'
  symbol: string
  interval: string
  marketType: 'spot' | 'swap'
  semanticReason?: string
  candidates: Array<Record<string, number | string | boolean>>
  run: (bars: OptimizerBar[], params: Record<string, number | string | boolean>) => SimulationResult
}

const INITIAL_CASH = 10000
const ADMISSION: AdmissionRule = {
  maxDrawdownPctCeiling: 20,
  minWinRate: 0.52,
  minTradeCount: 20,
  minTotalReturnPct: 0.5,
}
const EVIDENCE_PATH = 'apps/quantify/src/modules/llm-strategy-codegen/constants/official-strategy-plaza-backtest-evidence.json'
const EVIDENCE_CONSTANT_PATH = 'apps/quantify/src/modules/llm-strategy-codegen/constants/official-strategy-plaza-backtest-evidence.constant.ts'
const FIXED_BACKTEST_END_TS = 1777168800000
const OKX_PAGE_LIMIT = 300
const OKX_PAGE_COUNT = 8
const BINANCE_PAGE_LIMIT = 1000
const BINANCE_PAGE_COUNT = 3

export function calculateBacktestMetrics(input: {
  initialCash: number
  equityCurve: OptimizerEquityPoint[]
  trades: OptimizerTrade[]
}): OptimizerMetrics {
  const lastEquity = input.equityCurve.at(-1)?.equity ?? input.initialCash
  let peak = input.initialCash
  let maxDrawdownPct = 0
  for (const point of input.equityCurve) {
    peak = Math.max(peak, point.equity)
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdown)
  }
  const wins = input.trades.filter(trade => trade.pnlPct > 0).length
  return {
    winRate: input.trades.length > 0 ? Number((wins / input.trades.length).toFixed(4)) : 0,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    totalReturnPct: Number((((lastEquity - input.initialCash) / input.initialCash) * 100).toFixed(2)),
    tradeCount: input.trades.length,
  }
}

export function selectBestCandidate(
  candidates: TemplateOptimizationCandidate[],
  admission: {
    maxDrawdownPctCeiling: number
    minWinRate: number
    minTradeCount: number
    minTotalReturnPct?: number
  },
): TemplateOptimizationCandidate | null {
  const eligible = candidates.filter(candidate =>
    candidate.metrics.maxDrawdownPct <= admission.maxDrawdownPctCeiling
    && candidate.metrics.winRate >= admission.minWinRate
    && candidate.metrics.tradeCount >= admission.minTradeCount
    && candidate.metrics.totalReturnPct >= (admission.minTotalReturnPct ?? Number.NEGATIVE_INFINITY),
  )
  eligible.sort((left, right) => {
    const leftScore = left.metrics.totalReturnPct + left.metrics.winRate * 100 - left.metrics.maxDrawdownPct
    const rightScore = right.metrics.totalReturnPct + right.metrics.winRate * 100 - right.metrics.maxDrawdownPct
    return rightScore - leftScore
  })
  return eligible[0] ?? null
}

export function renderEvidenceConstantSource(evidence: unknown): string {
  return [
    'import type { OfficialStrategyPlazaBacktestEvidence } from \'../../strategy-plaza/types/official-strategy-plaza-template\'',
    '',
    `export const OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE: OfficialStrategyPlazaBacktestEvidence = ${JSON.stringify(evidence, null, 2)}`,
    '',
  ].join('\n')
}

export function runMovingAverageLongOnly(
  bars: OptimizerBar[],
  params: MovingAverageLongOnlyParams,
): SimulationResult {
  return runLongOnlySimulation(bars, params, (context) => {
    const fastMa = movingAverage(context.bars, context.index, params.fastPeriod)
    const slowMa = movingAverage(context.bars, context.index, params.slowPeriod)
    const previousFastMa = movingAverage(context.bars, context.index - 1, params.fastPeriod)
    const previousSlowMa = movingAverage(context.bars, context.index - 1, params.slowPeriod)

    return {
      enter: fastMa != null && slowMa != null && (
        previousFastMa == null
        || previousSlowMa == null
        || (previousFastMa <= previousSlowMa && fastMa > slowMa)
      ),
      exit: fastMa != null && slowMa != null && fastMa < slowMa,
    }
  })
}

async function fetchOkxCandles(input: {
  instId: string
  bar: string
  limit: number
  fixedEndTs: number
  pageCount: number
}): Promise<OptimizerBar[]> {
  const bars: OptimizerBar[] = []
  let cursorTs = input.fixedEndTs

  for (let page = 0; page < input.pageCount; page += 1) {
    const url = new URL('https://www.okx.com/api/v5/market/history-candles')
    url.searchParams.set('instId', input.instId)
    url.searchParams.set('bar', input.bar)
    url.searchParams.set('limit', String(input.limit))
    url.searchParams.set('after', String(cursorTs))
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`OKX candle fetch failed: ${response.status}`)
    const payload = await response.json() as { data?: string[][] }
    const pageBars = (payload.data ?? []).map(mapOkxCandle)
    if (pageBars.length === 0)
      break

    bars.push(...pageBars)
    cursorTs = Math.min(...pageBars.map(bar => bar.ts))
  }

  return sortUniqueBars(bars)
}

function mapOkxCandle(row: string[]): OptimizerBar {
  return {
    ts: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }
}

async function fetchBinanceKlines(input: {
  symbol: string
  interval: string
  limit: number
  fixedEndTs: number
  pageCount: number
}): Promise<OptimizerBar[]> {
  const bars: OptimizerBar[] = []
  let cursorTs = input.fixedEndTs

  for (let page = 0; page < input.pageCount; page += 1) {
    const url = new URL('https://api.binance.com/api/v3/klines')
    url.searchParams.set('symbol', input.symbol)
    url.searchParams.set('interval', input.interval)
    url.searchParams.set('limit', String(input.limit))
    url.searchParams.set('endTime', String(cursorTs))
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Binance kline fetch failed: ${response.status}`)
    const payload = await response.json() as unknown[][]
    const pageBars = payload.map(mapBinanceKline)
    if (pageBars.length === 0)
      break

    bars.push(...pageBars)
    cursorTs = Math.min(...pageBars.map(bar => bar.ts)) - 1
  }

  return sortUniqueBars(bars)
}

function mapBinanceKline(row: unknown[]): OptimizerBar {
  return {
    ts: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }
}

function sortUniqueBars(bars: OptimizerBar[]): OptimizerBar[] {
  return Array.from(new Map(bars.map(bar => [bar.ts, bar])).values())
    .sort((left, right) => left.ts - right.ts)
}

function runLongOnlySimulation(
  bars: OptimizerBar[],
  params: {
    stopLossPct: number
    takeProfitPct: number
    positionPct: number
  },
  signal: (context: { bars: OptimizerBar[], index: number }) => { enter: boolean, exit: boolean },
): SimulationResult {
  let cash = INITIAL_CASH
  let positionUnits = 0
  let entryPrice = 0
  let entryTs = 0
  const equityCurve: OptimizerEquityPoint[] = []
  const trades: OptimizerTrade[] = []

  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index]
    const currentSignal = signal({ bars, index })

    if (positionUnits > 0) {
      const stopPrice = entryPrice * (1 - params.stopLossPct / 100)
      const takePrice = entryPrice * (1 + params.takeProfitPct / 100)
      const exitPrice = bar.low <= stopPrice
        ? stopPrice
        : bar.high >= takePrice
          ? takePrice
          : currentSignal.exit
            ? bar.close
            : null

      if (exitPrice != null) {
        cash += positionUnits * exitPrice
        trades.push({
          entryTs,
          exitTs: bar.ts,
          entryPrice: roundPrice(entryPrice),
          exitPrice: roundPrice(exitPrice),
          pnlPct: Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
        })
        positionUnits = 0
        entryPrice = 0
        entryTs = 0
      }
    }

    if (positionUnits === 0 && currentSignal.enter) {
      const allocation = cash * (params.positionPct / 100)
      positionUnits = allocation / bar.close
      cash -= allocation
      entryPrice = bar.close
      entryTs = bar.ts
    }

    equityCurve.push({
      ts: bar.ts,
      equity: Number((cash + positionUnits * bar.close).toFixed(2)),
    })
  }

  const finalBar = bars.at(-1)
  if (finalBar != null && positionUnits > 0) {
    cash += positionUnits * finalBar.close
    trades.push({
      entryTs,
      exitTs: finalBar.ts,
      entryPrice: roundPrice(entryPrice),
      exitPrice: roundPrice(finalBar.close),
      pnlPct: Number((((finalBar.close - entryPrice) / entryPrice) * 100).toFixed(2)),
    })
    equityCurve[equityCurve.length - 1] = {
      ts: finalBar.ts,
      equity: Number(cash.toFixed(2)),
    }
  }

  return {
    equityCurve,
    trades,
    metrics: calculateBacktestMetrics({
      initialCash: INITIAL_CASH,
      equityCurve,
      trades,
    }),
  }
}

function movingAverage(bars: OptimizerBar[], index: number, period: number): number | null {
  if (period <= 0 || index < period - 1)
    return null

  const slice = bars.slice(index - period + 1, index + 1)
  return slice.reduce((sum, bar) => sum + bar.close, 0) / period
}

function standardDeviation(values: number[]): number {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function rsi(bars: OptimizerBar[], index: number, period: number): number | null {
  if (period <= 0 || index < period)
    return null

  let gains = 0
  let losses = 0
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const change = bars[cursor].close - bars[cursor - 1].close
    if (change >= 0)
      gains += change
    else
      losses += Math.abs(change)
  }

  if (losses === 0)
    return 100
  const relativeStrength = gains / losses
  return 100 - (100 / (1 + relativeStrength))
}

function emaSeries(bars: OptimizerBar[], period: number): Array<number | null> {
  const result: Array<number | null> = Array.from({ length: bars.length }, () => null)
  if (period <= 0 || bars.length < period)
    return result

  let previous = bars.slice(0, period).reduce((sum, bar) => sum + bar.close, 0) / period
  const multiplier = 2 / (period + 1)
  result[period - 1] = previous
  for (let index = period; index < bars.length; index += 1) {
    previous = (bars[index].close - previous) * multiplier + previous
    result[index] = previous
  }
  return result
}

function macdSeries(
  bars: OptimizerBar[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): Array<{ dif: number, dea: number } | null> {
  const fast = emaSeries(bars, fastPeriod)
  const slow = emaSeries(bars, slowPeriod)
  const difValues = bars.map((_, index) =>
    fast[index] != null && slow[index] != null ? fast[index]! - slow[index]! : null,
  )
  const result: Array<{ dif: number, dea: number } | null> = Array.from({ length: bars.length }, () => null)
  const seeded: number[] = []
  let dea: number | null = null
  const multiplier = 2 / (signalPeriod + 1)

  for (let index = 0; index < difValues.length; index += 1) {
    const dif = difValues[index]
    if (dif == null)
      continue

    if (dea == null) {
      seeded.push(dif)
      if (seeded.length < signalPeriod)
        continue
      dea = seeded.reduce((sum, value) => sum + value, 0) / seeded.length
    }
    else {
      dea = (dif - dea) * multiplier + dea
    }

    result[index] = { dif, dea }
  }

  return result
}

function highestHigh(bars: OptimizerBar[], index: number, period: number): number | null {
  if (period <= 0 || index < period)
    return null
  return Math.max(...bars.slice(index - period, index).map(bar => bar.high))
}

function lowestLow(bars: OptimizerBar[], index: number, period: number): number | null {
  if (period <= 0 || index < period)
    return null
  return Math.min(...bars.slice(index - period, index).map(bar => bar.low))
}

function roundPrice(value: number): number {
  return Number(value.toFixed(8))
}

function runBollingerReversion(bars: OptimizerBar[], params: Record<string, number | string | boolean>): SimulationResult {
  const period = Number(params.period)
  const deviation = Number(params.deviation)
  return runLongOnlySimulation(bars, numericRiskParams(params), (context) => {
    if (context.index < period - 1)
      return { enter: false, exit: false }

    const window = context.bars.slice(context.index - period + 1, context.index + 1).map(bar => bar.close)
    const average = window.reduce((sum, value) => sum + value, 0) / window.length
    const bandWidth = standardDeviation(window) * deviation
    const close = context.bars[context.index].close
    return {
      enter: close < average - bandWidth,
      exit: close > average,
    }
  })
}

function runGridRange(bars: OptimizerBar[], params: Record<string, number | string | boolean>): SimulationResult {
  const lookback = Number(params.lookback)
  const lowerBand = Number(params.lowerBand)
  const upperBand = Number(params.upperBand)
  return runLongOnlySimulation(bars, numericRiskParams(params), (context) => {
    const low = lowestLow(context.bars, context.index, lookback)
    const high = highestHigh(context.bars, context.index, lookback)
    if (low == null || high == null || high <= low)
      return { enter: false, exit: false }

    const close = context.bars[context.index].close
    const range = high - low
    return {
      enter: close <= low + range * lowerBand,
      exit: close >= low + range * upperBand,
    }
  })
}

function runBreakoutFollow(bars: OptimizerBar[], params: Record<string, number | string | boolean>): SimulationResult {
  const lookback = Number(params.lookback)
  const breakoutBufferPct = Number(params.breakoutBufferPct)
  return runLongOnlySimulation(bars, numericRiskParams(params), (context) => {
    const breakoutHigh = highestHigh(context.bars, context.index, lookback)
    const trailLow = lowestLow(context.bars, context.index, Math.max(2, Math.floor(lookback / 2)))
    const close = context.bars[context.index].close
    return {
      enter: breakoutHigh != null && close >= breakoutHigh * (1 - breakoutBufferPct / 100),
      exit: trailLow != null && close < trailLow,
    }
  })
}

function runRsiReversal(bars: OptimizerBar[], params: Record<string, number | string | boolean>): SimulationResult {
  const period = Number(params.period)
  const oversold = Number(params.oversold)
  const exitLevel = Number(params.exitLevel)
  return runLongOnlySimulation(bars, numericRiskParams(params), (context) => {
    const currentRsi = rsi(context.bars, context.index, period)
    const previousRsi = rsi(context.bars, context.index - 1, period)
    return {
      enter: currentRsi != null && previousRsi != null && previousRsi <= oversold && currentRsi > oversold,
      exit: currentRsi != null && currentRsi >= exitLevel,
    }
  })
}

function runMacdCross(bars: OptimizerBar[], params: Record<string, number | string | boolean>): SimulationResult {
  const fastPeriod = Number(params.fastPeriod)
  const slowPeriod = Number(params.slowPeriod)
  const signalPeriod = Number(params.signalPeriod)
  const macd = macdSeries(bars, fastPeriod, slowPeriod, signalPeriod)
  return runLongOnlySimulation(bars, numericRiskParams(params), (context) => {
    const current = macd[context.index]
    const previous = macd[context.index - 1]
    return {
      enter: current != null && previous != null && previous.dif <= previous.dea && current.dif > current.dea,
      exit: current != null && previous != null && previous.dif >= previous.dea && current.dif < current.dea,
    }
  })
}

function numericRiskParams(params: Record<string, number | string | boolean>): {
  stopLossPct: number
  takeProfitPct: number
  positionPct: number
} {
  return {
    stopLossPct: Number(params.stopLossPct),
    takeProfitPct: Number(params.takeProfitPct),
    positionPct: Number(params.positionPct),
  }
}

function buildSearchSpecs(): TemplateSearchSpec[] {
  return [
    {
      templateId: 'ma-cross',
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      interval: '15m',
      marketType: 'swap',
      candidates: expandParams({
        fastPeriod: [6, 8, 12, 16],
        slowPeriod: [18, 24, 36, 48],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.6, 1, 1.6, 2.4],
        positionPct: [25, 35],
      }).filter(params => Number(params.fastPeriod) < Number(params.slowPeriod)),
      run: (bars, params) => runMovingAverageLongOnly(bars, {
        fastPeriod: Number(params.fastPeriod),
        slowPeriod: Number(params.slowPeriod),
        stopLossPct: Number(params.stopLossPct),
        takeProfitPct: Number(params.takeProfitPct),
        positionPct: Number(params.positionPct),
      }),
    },
    {
      templateId: 'bollinger-reversion',
      exchange: 'okx',
      symbol: 'ETH-USDT-SWAP',
      interval: '15m',
      marketType: 'swap',
      candidates: expandParams({
        period: [12, 18, 24, 30],
        deviation: [0.9, 1.1, 1.4, 1.8],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.5, 0.8, 1.2, 1.8],
        positionPct: [25, 35],
      }),
      run: runBollingerReversion,
    },
    {
      templateId: 'grid-range',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      interval: '15m',
      marketType: 'spot',
      candidates: expandParams({
        lookback: [16, 24, 36, 48],
        lowerBand: [0.2, 0.3, 0.4],
        upperBand: [0.55, 0.65, 0.75],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.45, 0.75, 1.1],
        positionPct: [25, 35],
      }).filter(params => Number(params.lowerBand) < Number(params.upperBand)),
      run: runGridRange,
    },
    {
      templateId: 'breakout-follow',
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      interval: '15m',
      marketType: 'swap',
      candidates: expandParams({
        lookback: [8, 12, 18, 24],
        breakoutBufferPct: [0, 0.25, 0.5, 0.75, 1],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.6, 1, 1.6, 2.4],
        positionPct: [25, 35],
      }),
      run: runBreakoutFollow,
    },
    {
      templateId: 'rsi-reversal',
      exchange: 'okx',
      symbol: 'ETH-USDT',
      interval: '15m',
      marketType: 'spot',
      candidates: expandParams({
        period: [6, 10, 14],
        oversold: [38, 42, 46, 50],
        exitLevel: [52, 56, 60, 64],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.5, 0.8, 1.2, 1.8],
        positionPct: [25, 35],
      }).filter(params => Number(params.oversold) < Number(params.exitLevel)),
      run: runRsiReversal,
    },
    {
      templateId: 'macd-cross',
      exchange: 'okx',
      symbol: 'ETH-USDT-SWAP',
      interval: '15m',
      marketType: 'swap',
      candidates: expandParams({
        fastPeriod: [8, 12, 16],
        slowPeriod: [21, 26, 34],
        signalPeriod: [7, 9, 12],
        stopLossPct: [2, 3, 5],
        takeProfitPct: [0.5, 0.8, 1.2, 1.8],
        positionPct: [25, 35],
      }).filter(params => Number(params.fastPeriod) < Number(params.slowPeriod)),
      run: runMacdCross,
    },
  ]
}

function expandParams(grid: Record<string, Array<number | string | boolean>>): Array<Record<string, number | string | boolean>> {
  return Object.entries(grid).reduce<Array<Record<string, number | string | boolean>>>(
    (paramsList, [key, values]) => paramsList.flatMap(params => values.map(value => ({ ...params, [key]: value }))),
    [{}],
  )
}

async function generateEvidence(): Promise<void> {
  const specs = buildSearchSpecs()
  const barsBySource = new Map<string, OptimizerBar[]>()
  const blockers: string[] = []
  const entries = []

  for (const spec of specs) {
    const sourceKey = `${spec.exchange}:${spec.symbol}:${spec.interval}`
    if (!barsBySource.has(sourceKey)) {
      const bars = spec.exchange === 'okx'
        ? await fetchOkxCandles({
            instId: spec.symbol,
            bar: spec.interval,
            limit: OKX_PAGE_LIMIT,
            fixedEndTs: FIXED_BACKTEST_END_TS,
            pageCount: OKX_PAGE_COUNT,
          })
        : await fetchBinanceKlines({
            symbol: spec.symbol,
            interval: spec.interval,
            limit: BINANCE_PAGE_LIMIT,
            fixedEndTs: FIXED_BACKTEST_END_TS,
            pageCount: BINANCE_PAGE_COUNT,
          })
      barsBySource.set(sourceKey, bars.filter(isValidBar))
    }

    const bars = barsBySource.get(sourceKey) ?? []
    const candidates = spec.candidates.map(params => ({
      templateId: spec.templateId,
      params,
      metrics: spec.run(bars, params).metrics,
    }))
    const best = selectBestCandidate(candidates, ADMISSION)

    if (best == null) {
      blockers.push(`${spec.templateId}: no candidate passed admission from ${bars.length} public candles`)
      continue
    }

    const endpoint = spec.exchange === 'okx'
      ? 'https://www.okx.com/api/v5/market/history-candles'
      : 'https://api.binance.com/api/v3/klines'
    entries.push({
      templateId: spec.templateId,
      parameterSearchId: `official-template-search:${spec.templateId}:${spec.symbol}:${spec.interval}:${FIXED_BACKTEST_END_TS}`,
      exchange: spec.exchange,
      symbol: spec.symbol,
      interval: spec.interval,
      marketType: spec.marketType,
      source: endpoint,
      dataSource: {
        exchange: spec.exchange,
        marketType: spec.marketType,
        endpoint,
        fixedEndTs: FIXED_BACKTEST_END_TS,
        pagination: spec.exchange === 'okx'
          ? { parameter: 'after', pageLimit: OKX_PAGE_LIMIT, pageCount: OKX_PAGE_COUNT }
          : { parameter: 'endTime', pageLimit: BINANCE_PAGE_LIMIT, pageCount: BINANCE_PAGE_COUNT },
      },
      semanticReason: spec.semanticReason,
      backtestFrom: bars[0]?.ts ?? null,
      backtestTo: bars.at(-1)?.ts ?? null,
      admission: ADMISSION,
      candidateCount: candidates.length,
      candleCount: bars.length,
      fromTs: bars[0]?.ts ?? null,
      toTs: bars.at(-1)?.ts ?? null,
      params: best.params,
      metrics: best.metrics,
      best: {
        params: best.params,
        metrics: best.metrics,
      },
    })
  }

  const evidence = blockers.length > 0 || entries.length !== 6
    ? {
        status: 'BLOCKED',
        generatedAt: new Date().toISOString(),
        generatedBy: 'apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts',
        admission: ADMISSION,
        blockers,
        templates: entries,
      }
    : {
        status: 'VERIFIED',
        generatedAt: new Date().toISOString(),
        generatedBy: 'apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts',
        admission: ADMISSION,
        templates: entries,
      }

  const outputPath = resolveWorkspacePath(EVIDENCE_PATH)
  const constantOutputPath = resolveWorkspacePath(EVIDENCE_CONSTANT_PATH)
  await mkdir(dirname(outputPath), { recursive: true })
  await mkdir(dirname(constantOutputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  await writeFile(constantOutputPath, renderEvidenceConstantSource(evidence), 'utf8')

  if (evidence.status === 'BLOCKED')
    throw new Error(`Official strategy plaza evidence generation blocked: ${blockers.join('; ')}`)
}

function isValidBar(bar: OptimizerBar): boolean {
  return [bar.ts, bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)
    && bar.open > 0
    && bar.high > 0
    && bar.low > 0
    && bar.close > 0
}

function resolveWorkspacePath(path: string): string {
  const cwd = process.cwd()
  return cwd.endsWith('/apps/quantify')
    ? resolve(cwd, '../..', path)
    : resolve(cwd, path)
}

if (require.main === module) {
  generateEvidence().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
