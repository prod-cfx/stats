import { OrderAdmissionGateService } from './order-admission-gate.service'
import type { OrderIntent } from '../types/trading-execution.types'

const baseIntent: OrderIntent = {
  source: 'grid',
  sourceId: 'order-1',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.1,
  price: 79200,
  role: 'close_short',
  reduceOnly: true,
}

describe('OrderAdmissionGateService', () => {
  it('waits when a close-short intent has no short position', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate(baseIntent, [])
    expect(result).toEqual({ ok: false, status: 'waiting_position', reason: 'missing_closable_short_position' })
  })

  it('allows a close-short intent with a matching short position', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate(baseIntent, [{
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'short',
      size: 0.2,
      entryPrice: 80000,
      unrealizedPnl: 0,
      raw: {},
    }])
    expect(result).toEqual({ ok: true })
  })

  it('rejects close-short intent with sell side even with a matching short position', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, side: 'sell' }, [{
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'short',
      size: 0.2,
      entryPrice: 80000,
      unrealizedPnl: 0,
      raw: {},
    }])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'close_short_requires_buy_side' })
  })

  it('rejects close-long intent with buy side even with a matching long position', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'close_long', side: 'buy' }, [{
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'long',
      size: 0.2,
      entryPrice: 80000,
      unrealizedPnl: 0,
      raw: {},
    }])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'close_long_requires_sell_side' })
  })

  it('rejects open-long intent with sell side', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'open_long', side: 'sell', reduceOnly: false }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'open_long_requires_buy_side' })
  })

  it('rejects open-short intent with buy side', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'open_short', side: 'buy', reduceOnly: false }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'open_short_requires_sell_side' })
  })

  it('rejects spot-buy intent with sell side', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'spot_buy', side: 'sell', marketType: 'spot', symbol: 'BTC/USDT', reduceOnly: false }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'spot_buy_requires_buy_side' })
  })

  it('rejects spot-buy intent on perp market', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'spot_buy', side: 'buy', marketType: 'perp' }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'spot_role_requires_spot_market' })
  })

  it('rejects spot-sell intent with buy side', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'spot_sell', side: 'buy', marketType: 'spot', symbol: 'BTC/USDT', reduceOnly: false }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'spot_sell_requires_sell_side' })
  })

  it('rejects open-long intent on spot market', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'open_long', side: 'buy', marketType: 'spot', symbol: 'BTC/USDT' }, [])
    expect(result).toEqual({ ok: false, status: 'rejected', reason: 'perp_role_requires_perp_market' })
  })

  it('allows an open intent without positions', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: 'open_long', reduceOnly: false }, [])
    expect(result).toEqual({ ok: true })
  })

  it('infers a reduce-only sell intent requires a matching long position', () => {
    const service = new OrderAdmissionGateService()
    const result = service.evaluate({ ...baseIntent, role: null, side: 'sell', reduceOnly: true }, [{
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'long',
      size: 0.1,
      entryPrice: 79000,
      unrealizedPnl: 0,
      raw: {},
    }])
    expect(result).toEqual({ ok: true })
  })
})
