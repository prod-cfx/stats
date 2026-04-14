import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('trades ws adapter layering', () => {
  const binancePath = resolve(__dirname, 'binance/binance-trades-ws.base.ts')
  const okxPath = resolve(__dirname, 'okx/okx-trades-ws.base.ts')
  const hyperliquidPath = resolve(__dirname, 'hyperliquid/hyperliquid-trades-ws.base.ts')
  const marketTradesRepositoryPath = resolve(__dirname, '../../../markets/repositories/market-trades.repository.ts')

  it('keeps marketTrade persistence behind MarketTradesRepository for binance and okx adapters', () => {
    const binanceSource = readFileSync(binancePath, 'utf8')
    const okxSource = readFileSync(okxPath, 'utf8')
    const repositorySource = readFileSync(marketTradesRepositoryPath, 'utf8')

    expect(repositorySource).toContain('async createManyTrades(')
    expect(binanceSource).toContain('this.marketTradesRepository.createManyTrades(records)')
    expect(okxSource).toContain('this.marketTradesRepository.createManyTrades(records)')
    expect(binanceSource).not.toContain('this.prismaService.marketTrade.createMany')
    expect(okxSource).not.toContain('this.prismaService.marketTrade.createMany')
  })

  it('removes direct PrismaService dependency from trades ws base adapters', () => {
    const binanceSource = readFileSync(binancePath, 'utf8')
    const okxSource = readFileSync(okxPath, 'utf8')
    const hyperliquidSource = readFileSync(hyperliquidPath, 'utf8')

    expect(binanceSource).not.toContain("import { PrismaService }")
    expect(okxSource).not.toContain("import { PrismaService }")
    expect(hyperliquidSource).not.toContain("import { PrismaService }")
  })
})
