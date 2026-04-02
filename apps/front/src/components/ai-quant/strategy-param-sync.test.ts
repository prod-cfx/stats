import { applyCapabilitiesToParamSchema, syncStrategyParamsFromCodegen } from './strategy-param-sync'

describe('strategy-param-sync', () => {
  it('syncs strategy params from codegen spec into dynamic schema and values', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        entryRules: ['BTCUSDT 当 BTC/USDT 价格达到 66830 时买入'],
        exitRules: ['BTCUSDT 当 BTC/USDT 价格上涨到 66890 时卖出'],
        riskRules: { positionPct: 10, maxDrawdownPct: 20 },
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      currentValues: {
        backtestRangePreset: '30D',
      },
      capabilities: {
        allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'ETHUSDC'],
        allowedBaseTimeframes: ['15m', '1h'],
      },
      contextText: '在 OKX 上用 10% 仓位',
    })

    expect(result.normalized.exchange).toBe('okx')
    expect(result.paramValues.exchange).toBe('okx')
    expect(result.paramValues.symbol).toBe('BTCUSDT')
    expect(result.paramValues.baseTimeframe).toBe('15m')
    expect(result.paramValues.positionPct).toBe(10)
    expect(result.paramValues.entryPrice).toBe(66830)
    expect(result.paramValues.exitPrice).toBe(66890)
    expect(result.paramValues.maxDrawdownPct).toBe(20)
    expect(result.paramValues.backtestRangePreset).toBe('30D')
    expect((result.paramSchema.properties as Record<string, any>).symbol.enum).toEqual(['BTCUSDT', 'ETHUSDT', 'ETHUSDC'])
    expect(result.executionTags).toEqual(expect.arrayContaining([
      'positionPct: 10',
      'entryPrice: 66830',
      'exitPrice: 66890',
      'maxDrawdownPct: 20',
    ]))
  })

  it('refreshes symbol and timeframe enums from capabilities without dropping dynamic fields', () => {
    const nextSchema = applyCapabilitiesToParamSchema(
      {
        type: 'object',
        required: ['symbol', 'baseTimeframe', 'entryPrice'],
        properties: {
          symbol: { type: 'string', title: 'Symbol', enum: ['BTCUSDT'] },
          baseTimeframe: { type: 'string', title: 'Base Timeframe', enum: ['15m'] },
          entryPrice: { type: 'number', title: 'Entry Price' },
        },
      },
      {
        allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'ETHUSDC'],
        allowedBaseTimeframes: ['15m', '1h'],
      },
    ) as Record<string, any>

    expect(nextSchema.properties.symbol.enum).toEqual(['BTCUSDT', 'ETHUSDT', 'ETHUSDC'])
    expect(nextSchema.properties.baseTimeframe.enum).toEqual(['15m', '1h'])
    expect(nextSchema.properties.entryPrice.title).toBe('Entry Price')
  })
})
