import { MarketInstrumentSymbolResolverService } from '../market-instrument-symbol-resolver.service'

describe('MarketInstrumentSymbolResolverService', () => {
  const resolver = new MarketInstrumentSymbolResolverService()

  it.each([
    ['ETHUSDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH/USDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH-USDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH usdt', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH USDC', 'ETHUSDC', 'user_explicit', 'explicit'],
    ['BTC USD', 'BTCUSD', 'user_explicit', 'explicit'],
  ] as const)('resolves explicit symbol text %s', (input, value, source, quoteSource) => {
    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      source,
      quoteSource,
    }))
  })

  it.each([
    ['ETH', 'ETHUSDT', 'ETH'],
    ['BTC', 'BTCUSDT', 'BTC'],
    ['ETH 永续合约', 'ETHUSDT', 'ETH'],
    ['BTC 永续合约', 'BTCUSDT', 'BTC'],
    ['以太坊', 'ETHUSDT', 'ETH'],
    ['比特币合约', 'BTCUSDT', 'BTC'],
  ] as const)('resolves inferred USDT symbol text %s', (input, value, base) => {
    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      base,
      quote: 'USDT',
      source: 'inferred',
      quoteSource: 'default_usdt',
    }))
  })

  it.each([
    ['ETHUSDT-SWAP', 'ETHUSDT', 'ETHUSDT-SWAP'],
    ['ETHUSDT:PERP', 'ETHUSDT', 'ETHUSDT:PERP'],
    ['ETHUSDT:SPOT', 'ETHUSDT', 'ETHUSDT:SPOT'],
  ] as const)('preserves venue symbol hints from %s', (input, value, venueSymbolHint) => {
    const marketTypeHint = input.endsWith(':SPOT') ? 'spot' : 'perp'

    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      venueSymbolHint,
      marketTypeHint,
    }))
  })

  it('does not infer ordinary English as a symbol', () => {
    expect(resolver.resolve('please continue the strategy')).toBeNull()
    expect(resolver.resolve('price above 100 USDT')).toBeNull()
  })

  it('builds a market identify instrument context contract', () => {
    const resolution = resolver.resolve('ETH usdt')

    expect(resolution).not.toBeNull()
    expect(resolver.buildContextContract(resolution!)).toEqual(expect.objectContaining({
      kind: 'context',
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          domain: 'market',
          verb: 'identify',
          object: 'instrument',
          shape: expect.objectContaining({ symbol: 'ETHUSDT' }),
        }),
      ]),
    }))
  })
})
