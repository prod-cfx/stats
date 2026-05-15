/**
 * Lane C: ATR trailing stop end-to-end smoke through evaluateRiskPredicates.
 *
 * 完整链路:
 *   canonical-spec-builder (risk.atr_stop) → ir compiler (atrTrailingStop predicate)
 *   → compiled runtime (evaluateRiskPredicates 调度 atrTrailingStop)
 *
 * 本 spec 直接构造 IR-side 风格的 risk-predicate node 喂给 evaluateRiskPredicates，
 * 验证 backtest 实际消费的 runtime 路径在 ATR trail stop 触发时返回 forceExit。
 */
import { evaluateRiskPredicates } from '@ai/shared/script-engine/compiled-runtime'

interface Bar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

function buildBars(length: number, opts: { startClose?: number; delta?: number; swing?: number }): Bar[] {
  const startClose = opts.startClose ?? 100
  const delta = opts.delta ?? 0
  const swing = opts.swing ?? 1
  return Array.from({ length }, (_, i) => {
    const close = startClose + delta * i
    return {
      open: close - delta / 2,
      high: close + swing,
      low: close - swing,
      close,
      volume: 1,
      timestamp: 1_000_000 + i * 60_000,
    }
  })
}

describe('backtest compiled runtime compat: risk.atr_stop (atrTrailingStop)', () => {
  const baseGuard = {
    strategyHalt: false,
    blockNewEntry: false,
    forceExit: false,
    cancelOrderPrograms: false,
    triggered: [] as string[],
  }

  it('long position: trail stop holds during sustained uptrend → no forceExit', () => {
    const bars = buildBars(30, { delta: 1, swing: 1, startClose: 100 })
    const last = bars[bars.length - 1]!
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: 1, avgEntryPrice: 100, barsHeld: 25 },
        currentPrice: last.close,
        bars,
      } as any,
      [
        {
          id: 'risk_predicate_01_atr_stop',
          payload: {
            id: 'risk-atr-stop',
            kind: 'atrTrailingStop',
            params: { period: 14, multiplier: 2 },
          },
        },
      ],
      baseGuard,
      ['risk_predicate_01_atr_stop'],
    )

    expect(guardState.forceExit).toBe(false)
    expect(guardState.triggered).toEqual([])
  })

  it('long position: sudden crash through trail stop → forceExit', () => {
    const upBars = buildBars(20, { delta: 1, swing: 1, startClose: 100 })
    const lastUp = upBars[upBars.length - 1]!
    const crashClose = lastUp.close - 25
    const crashBar: Bar = {
      open: lastUp.close,
      high: lastUp.close,
      low: crashClose,
      close: crashClose,
      volume: 1,
      timestamp: lastUp.timestamp + 60_000,
    }
    const bars = [...upBars, crashBar]
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: 1, avgEntryPrice: 100, barsHeld: 20 },
        currentPrice: crashClose,
        bars,
      } as any,
      [
        {
          id: 'risk_predicate_01_atr_stop',
          payload: {
            id: 'risk-atr-stop',
            kind: 'atrTrailingStop',
            params: { period: 14, multiplier: 2 },
          },
        },
      ],
      baseGuard,
      ['risk_predicate_01_atr_stop'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['risk_predicate_01_atr_stop'])
  })

  it('short position: sudden spike through trail stop → forceExit', () => {
    const downBars = buildBars(20, { delta: -1, swing: 1, startClose: 100 })
    const lastDown = downBars[downBars.length - 1]!
    const spikeClose = lastDown.close + 25
    const spikeBar: Bar = {
      open: lastDown.close,
      high: spikeClose,
      low: lastDown.close,
      close: spikeClose,
      volume: 1,
      timestamp: lastDown.timestamp + 60_000,
    }
    const bars = [...downBars, spikeBar]
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: -1, avgEntryPrice: 100, barsHeld: 20 },
        currentPrice: spikeClose,
        bars,
      } as any,
      [
        {
          id: 'risk_predicate_01_atr_stop',
          payload: {
            id: 'risk-atr-stop',
            kind: 'atrTrailingStop',
            params: { period: 14, multiplier: 2 },
          },
        },
      ],
      baseGuard,
      ['risk_predicate_01_atr_stop'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['risk_predicate_01_atr_stop'])
  })

  it('flat position (qty=0): no breach regardless of bars', () => {
    const bars = buildBars(30, { delta: 1, swing: 1, startClose: 100 })
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: 0, avgEntryPrice: 0, barsHeld: 0 },
        currentPrice: bars[bars.length - 1]!.close,
        bars,
      } as any,
      [
        {
          id: 'risk_predicate_01_atr_stop',
          payload: {
            id: 'risk-atr-stop',
            kind: 'atrTrailingStop',
            params: { period: 14, multiplier: 2 },
          },
        },
      ],
      baseGuard,
      ['risk_predicate_01_atr_stop'],
    )

    expect(guardState.forceExit).toBe(false)
  })
})
