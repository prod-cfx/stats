import { OrderNormalizerService } from './order-normalizer.service'
import type { OrderIntent, TradingExecutionConstraints } from '../types/trading-execution.types'

const constraints: TradingExecutionConstraints = {
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  rawSymbol: 'BTC-USDT-SWAP',
  priceTickSize: '0.1',
  quantityStepSize: '1',
  minQuantity: '1',
  contractValue: '0.01',
  clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
  raw: {},
}

const intent: OrderIntent = {
  source: 'grid',
  sourceId: 'planned-open-long',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.123,
  price: 79283.33333333333,
  role: 'open_long',
  timeInForce: 'GTC',
  tdMode: 'cross',
}

describe('OrderNormalizerService', () => {
  it('normalizes price, quantity and client order id from constraints', () => {
    const service = new OrderNormalizerService()

    const normalized = service.normalize(intent, constraints, 'gplannedopenlong')

    expect(normalized.request).toEqual(expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      price: 79283.3,
      amount: 0.12,
      timeInForce: 'GTC',
      tdMode: 'cross',
      clientOrderId: 'gplannedopenlong',
    }))
    expect(normalized.normalizedPrice).toBe('79283.3')
    expect(normalized.normalizedAmount).toBe('0.12')
    expect(normalized.exchangeSize).toBe('12')
  })

  it('rejects quantity below minimum exchange size', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize({ ...intent, amount: 0.001 }, constraints, 'gsmall'))
      .toThrow('trading_execution_quantity_below_minimum')
  })

  it('rejects perp constraints without contract value', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize(intent, { ...constraints, contractValue: null }, 'gnocontract'))
      .toThrow('trading_execution_missing_contract_value')
  })

  it('rejects missing quantity step size', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize(intent, { ...constraints, quantityStepSize: null }, 'gnoquantitystep'))
      .toThrow('trading_execution_missing_quantity_step')
  })

  it('rejects missing price tick size for limit orders', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize(intent, { ...constraints, priceTickSize: null }, 'gnopricetick'))
      .toThrow('trading_execution_missing_price_tick')
  })

  it('rejects constraints mismatch', () => {
    const service = new OrderNormalizerService()

    expect(() => service.normalize(intent, { ...constraints, rawSymbol: 'ETH-USDT-SWAP' }, 'gmismatch'))
      .toThrow('trading_execution_constraints_mismatch')
  })

  it('does not require price tick for market orders but still normalizes amount', () => {
    const service = new OrderNormalizerService()

    const normalized = service.normalize(
      { ...intent, type: 'market', price: undefined },
      { ...constraints, priceTickSize: null },
      'gmarket',
    )

    expect(normalized.request).toEqual(expect.objectContaining({
      type: 'market',
      price: undefined,
      amount: 0.12,
      clientOrderId: 'gmarket',
    }))
    expect(normalized.normalizedPrice).toBeUndefined()
    expect(normalized.normalizedAmount).toBe('0.12')
    expect(normalized.exchangeSize).toBe('12')
  })
})
