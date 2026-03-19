import { PortfolioLedgerService } from './portfolio-ledger.service'

describe('portfolioLedgerService', () => {
  it('should open long and reduce cash by fee only (perp model)', () => {
    const ledger = new PortfolioLedgerService(10000)
    ledger.applyFill({ symbol: 'BTCUSDT', ts: 1, side: 'BUY', qty: 1, price: 100, fee: 1, notional: 100 })
    expect(ledger.snapshot().cash).toBeCloseTo(9999)
  })

  it('should realize pnl on close', () => {
    const ledger = new PortfolioLedgerService(10000)
    ledger.applyFill({ symbol: 'BTCUSDT', ts: 1, side: 'BUY', qty: 1, price: 100, fee: 0, notional: 100 })
    ledger.applyFill({ symbol: 'BTCUSDT', ts: 2, side: 'SELL', qty: 1, price: 110, fee: 0, notional: 110 })
    expect(ledger.snapshot().positions.BTCUSDT?.qty ?? 0).toBe(0)
    expect(ledger.snapshot().realizedPnl).toBeCloseTo(10)
  })
})
