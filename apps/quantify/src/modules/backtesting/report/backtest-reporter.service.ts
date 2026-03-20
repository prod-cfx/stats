import type { BacktestReport, TradeMarker, TradeRecord } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'

interface OpenPayload {
  symbol: string
  ts: number
  price: number
  side: 'LONG' | 'SHORT'
  qty: number
  fee: number
  reason?: string
}

interface ClosePayload {
  symbol: string
  ts: number
  price: number
  side: 'LONG' | 'SHORT'
  qty: number
  fee: number
  pnl: number
  reason?: string
}

export class BacktestReporter {
  private readonly equityCurve: Array<{ ts: number; equity: number }> = []
  private readonly markers: TradeMarker[] = []
  private readonly trades: TradeRecord[] = []
  private readonly openTrades = new Map<string, TradeRecord>()
  private seq = 0

  pushEquity(ts: number, equity: number) {
    this.equityCurve.push({ ts, equity })
  }

  onTradeOpen(payload: OpenPayload) {
    const id = `t${++this.seq}`
    const draft: TradeRecord = {
      id,
      symbol: payload.symbol,
      side: payload.side,
      entryTs: payload.ts,
      entryPrice: payload.price,
      exitTs: payload.ts,
      exitPrice: payload.price,
      qty: payload.qty,
      fee: payload.fee,
      pnl: 0,
      returnPct: 0,
      reasonOpen: payload.reason,
    }

    this.openTrades.set(payload.symbol, draft)
    this.markers.push({
      symbol: payload.symbol,
      ts: payload.ts,
      price: payload.price,
      kind: payload.side === 'LONG' ? 'entry_long' : 'entry_short',
      tradeId: draft.id,
    })
  }

  onTradeClose(payload: ClosePayload) {
    const current = this.openTrades.get(payload.symbol)
    if (!current) return

    const closed: TradeRecord = {
      ...current,
      exitTs: payload.ts,
      exitPrice: payload.price,
      fee: current.fee + payload.fee,
      pnl: payload.pnl - current.fee - payload.fee,
      returnPct: this.computeReturnPct(current.side, current.entryPrice, payload.price),
      reasonClose: payload.reason,
    }

    this.trades.push(closed)
    this.openTrades.delete(payload.symbol)
    this.markers.push({
      symbol: payload.symbol,
      ts: payload.ts,
      price: payload.price,
      kind: payload.side === 'LONG' ? 'exit_long' : 'exit_short',
      tradeId: current.id,
    })
  }

  toReport(initialCash: number): BacktestReport {
    const realized = this.trades.reduce((sum, t) => sum + t.pnl, 0)
    const wins = this.trades.filter(t => t.pnl > 0)
    const losses = this.trades.filter(t => t.pnl < 0)
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))

    const bySymbol = Object.values(
      this.trades.reduce<Record<string, { symbol: string; pnl: number; trades: number; wins: number }>>((acc, trade) => {
        const stat = acc[trade.symbol] ?? { symbol: trade.symbol, pnl: 0, trades: 0, wins: 0 }
        stat.pnl += trade.pnl
        stat.trades += 1
        if (trade.pnl > 0) stat.wins += 1
        acc[trade.symbol] = stat
        return acc
      }, {}),
    ).map(stat => ({
      symbol: stat.symbol,
      pnl: stat.pnl,
      trades: stat.trades,
      winRate: stat.trades === 0 ? 0 : stat.wins / stat.trades,
    }))

    const drawdown = this.computeMaxDrawdown(this.equityCurve)

    return {
      summary: {
        netProfit: realized,
        netProfitPct: initialCash === 0 ? 0 : (realized / initialCash) * 100,
        maxDrawdownPct: drawdown,
        winRate: this.trades.length === 0 ? 0 : wins.length / this.trades.length,
        profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss,
        totalTrades: this.trades.length,
      },
      equityCurve: this.equityCurve,
      trades: this.trades,
      markers: this.markers,
      bySymbol,
    }
  }

  private computeMaxDrawdown(curve: Array<{ ts: number; equity: number }>): number {
    let peak = Number.NEGATIVE_INFINITY
    let maxDrawdown = 0

    curve.forEach(point => {
      if (point.equity > peak) peak = point.equity
      if (peak <= 0) return
      const dd = (peak - point.equity) / peak
      if (dd > maxDrawdown) maxDrawdown = dd
    })

    return maxDrawdown * 100
  }

  private computeReturnPct(side: 'LONG' | 'SHORT', entryPrice: number, exitPrice: number): number {
    if (entryPrice === 0) return 0
    const raw = side === 'LONG'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice
    return raw * 100
  }
}

@Injectable()
export class BacktestReporterService {
  create() {
    return new BacktestReporter()
  }
}
