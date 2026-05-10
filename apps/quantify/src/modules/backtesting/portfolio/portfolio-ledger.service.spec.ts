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

  it('persists entryTimeframe on the position and emits it in the OPEN event', () => {
    const ledger = new PortfolioLedgerService(10000)
    const events = ledger.applyFill({
      symbol: 'BTCUSDT', ts: 1, side: 'BUY', qty: 1, price: 100, fee: 0, notional: 100, entryTimeframe: '15m',
    })
    expect(events).toEqual([
      expect.objectContaining({ type: 'OPEN', entryTimeframe: '15m' }),
    ])
    expect(ledger.snapshot().positions.BTCUSDT?.entryTimeframe).toBe('15m')
  })

  it('clears entryTimeframe when fully closed and re-applies on direction flip', () => {
    const ledger = new PortfolioLedgerService(10000)
    ledger.applyFill({
      symbol: 'BTCUSDT', ts: 1, side: 'BUY', qty: 1, price: 100, fee: 0, notional: 100, entryTimeframe: '15m',
    })
    // 反向超量成交：先平掉 1，再以 1h 开空 1
    const flip = ledger.applyFill({
      symbol: 'BTCUSDT', ts: 2, side: 'SELL', qty: 2, price: 110, fee: 0, notional: 220, entryTimeframe: '1h',
    })
    expect(flip).toHaveLength(2)
    expect(flip[0]).toEqual(expect.objectContaining({ type: 'CLOSE' }))
    // CLOSE 事件不应携带 entryTimeframe（它只属于入场）
    expect(flip[0]).not.toHaveProperty('entryTimeframe')
    expect(flip[1]).toEqual(expect.objectContaining({ type: 'OPEN', entryTimeframe: '1h' }))
    expect(ledger.snapshot().positions.BTCUSDT?.entryTimeframe).toBe('1h')

    // 全部平仓后清空 entryTimeframe
    ledger.applyFill({
      symbol: 'BTCUSDT', ts: 3, side: 'BUY', qty: 1, price: 100, fee: 0, notional: 100,
    })
    expect(ledger.snapshot().positions.BTCUSDT).toBeUndefined()
  })

  it('preserves first entryTimeframe on same-direction increase (#1022)', () => {
    const ledger = new PortfolioLedgerService(10000)
    ledger.applyFill({
      symbol: 'BTCUSDT', ts: 1, side: 'BUY', qty: 1, price: 100, fee: 0, notional: 100, entryTimeframe: '15m',
    })
    const events = ledger.applyFill({
      symbol: 'BTCUSDT', ts: 2, side: 'BUY', qty: 1, price: 110, fee: 0, notional: 110, entryTimeframe: '1h',
    })
    // 同向加仓不应再产生 OPEN 事件，也不刷新 entryTimeframe
    expect(events).toEqual([])
    expect(ledger.snapshot().positions.BTCUSDT?.entryTimeframe).toBe('15m')
    expect(ledger.snapshot().positions.BTCUSDT?.qty).toBe(2)
  })
})
