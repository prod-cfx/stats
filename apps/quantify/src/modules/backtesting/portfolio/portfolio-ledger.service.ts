import type { Fill, PortfolioState, Position } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'

interface TradeLifecycleEvent {
  type: 'OPEN' | 'CLOSE'
  symbol: string
  side: 'LONG' | 'SHORT'
  ts: number
  price: number
  qty: number
  fee: number
  pnl?: number
}

export class PortfolioLedgerService {
  private state: PortfolioState

  constructor(initialCash: number) {
    this.state = {
      cash: initialCash,
      equity: initialCash,
      usedMargin: 0,
      realizedPnl: 0,
      positions: {},
    }
  }

  getPosition(symbol: string): Position {
    return this.state.positions[symbol] ?? {
      symbol,
      qty: 0,
      avgEntryPrice: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
    }
  }

  applyFill(fill: Fill): TradeLifecycleEvent[] {
    const events: TradeLifecycleEvent[] = []
    const prev = this.getPosition(fill.symbol)
    const next = { ...prev }

    this.state.cash -= fill.fee

    const signedQty = fill.side === 'BUY' ? fill.qty : -fill.qty

    if (prev.qty === 0 || Math.sign(prev.qty) === Math.sign(signedQty)) {
      const newQtyAbs = Math.abs(prev.qty) + Math.abs(signedQty)
      next.avgEntryPrice =
        newQtyAbs === 0
          ? 0
          : (Math.abs(prev.qty) * prev.avgEntryPrice + Math.abs(signedQty) * fill.price) / newQtyAbs
      next.qty = prev.qty + signedQty

      if (prev.qty === 0 && next.qty !== 0) {
        events.push({
          type: 'OPEN',
          symbol: fill.symbol,
          side: next.qty > 0 ? 'LONG' : 'SHORT',
          ts: fill.ts,
          price: fill.price,
          qty: Math.abs(next.qty),
          fee: fill.fee,
        })
      }
    } else {
      const closingQty = Math.min(Math.abs(prev.qty), Math.abs(signedQty))
      const closedPnl = prev.qty > 0
        ? (fill.price - prev.avgEntryPrice) * closingQty
        : (prev.avgEntryPrice - fill.price) * closingQty

      this.state.cash += closedPnl
      this.state.realizedPnl += closedPnl
      next.realizedPnl += closedPnl

      events.push({
        type: 'CLOSE',
        symbol: fill.symbol,
        side: prev.qty > 0 ? 'LONG' : 'SHORT',
        ts: fill.ts,
        price: fill.price,
        qty: closingQty,
        fee: fill.fee,
        pnl: closedPnl,
      })

      const remainder = Math.abs(signedQty) - closingQty
      if (remainder > 0) {
        next.qty = Math.sign(signedQty) * remainder
        next.avgEntryPrice = fill.price
        events.push({
          type: 'OPEN',
          symbol: fill.symbol,
          side: next.qty > 0 ? 'LONG' : 'SHORT',
          ts: fill.ts,
          price: fill.price,
          qty: Math.abs(next.qty),
          fee: 0,
        })
      } else {
        next.qty = 0
        next.avgEntryPrice = 0
      }
    }

    if (next.qty === 0) {
      delete this.state.positions[fill.symbol]
    } else {
      this.state.positions[fill.symbol] = next
    }

    return events
  }

  markToMarket(prices: Record<string, number>) {
    let unrealizedTotal = 0
    Object.entries(this.state.positions).forEach(([symbol, pos]) => {
      const current = prices[symbol]
      if (!current) return
      pos.unrealizedPnl = pos.qty > 0
        ? (current - pos.avgEntryPrice) * Math.abs(pos.qty)
        : (pos.avgEntryPrice - current) * Math.abs(pos.qty)
      unrealizedTotal += pos.unrealizedPnl
    })

    this.state.equity = this.state.cash + unrealizedTotal
  }

  snapshot(): PortfolioState {
    return {
      ...this.state,
      positions: { ...this.state.positions },
    }
  }
}

@Injectable()
export class PortfolioLedgerServiceFactory {
  create(initialCash: number) {
    return new PortfolioLedgerService(initialCash)
  }
}

export type { TradeLifecycleEvent }
