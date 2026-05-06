import { PositionSizingContractService } from '../position-sizing-contract.service'

describe('PositionSizingContractService', () => {
  const service = new PositionSizingContractService()

  it.each([
    ['用 10% 仓位', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['单笔百分之10资金', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['单笔百分之十资金', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['单笔百分之十五资金', { kind: 'ratio', value: 0.15, unit: 'ratio' }],
    ['单笔百分之二十资金', { kind: 'ratio', value: 0.2, unit: 'ratio' }],
    ['每次使用 0.1 资金比例', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['0.1 资金比例', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['BTC 跌到 60000 USDT 用 10% 仓位开多', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['资金费率达到 0.1% 用 10% 仓位开多', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['价格下跌 1% 时用 10% 仓位开多', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
  ])('parses ratio sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    ['固定使用 10 USDT', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['固定使用 10 USDT，止损 5%', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['固定使用 10 USDT 止损 5%', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['每次 10u', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['单笔 10 刀', { kind: 'quote', value: 10, asset: 'USD' }],
    ['投入 10 美元', { kind: 'quote', value: 10, asset: 'USD' }],
    ['每次 10 USDC', { kind: 'quote', value: 10, asset: 'USDC' }],
    ['每次 10 usdc', { kind: 'quote', value: 10, asset: 'USDC' }],
    ['BTC 跌到 60000 USDT 用 10u 开多', { kind: 'quote', value: 10, asset: 'USDT' }],
  ])('parses quote sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    ['每次买 0.001 BTC', { kind: 'base', value: 0.001, asset: 'BTC' }],
    ['固定 0.01 ETH', { kind: 'base', value: 0.01, asset: 'ETH' }],
    ['单笔 2 SOL', { kind: 'base', value: 2, asset: 'SOL' }],
    ['每次买 10 UNI', { kind: 'base', value: 10, asset: 'UNI' }],
    ['每次买 0.001 BTC 止损 5%', { kind: 'base', value: 0.001, asset: 'BTC' }],
    ['BTC 跌到 60000 USDT 买入 0.001 BTC', { kind: 'base', value: 0.001, asset: 'BTC' }],
  ])('parses base sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    '止损 10 USDT',
    '单笔风险 10 USDT',
    '亏损 10% 止损',
    '价格上涨 10% 开多',
    '资金费率达到 0.1% 开多',
    'BTC 跌到 60000 USDT 开多',
    '价格达到 30000 USDT 买入',
    'ETHBTC 跌到 0.001 BTC 买入',
    '价格到 0.001 BTC 买入',
    '5min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出',
  ])('does not parse risk text as position sizing: %s', (text) => {
    expect(service.parse(text)).toBeNull()
  })
})
