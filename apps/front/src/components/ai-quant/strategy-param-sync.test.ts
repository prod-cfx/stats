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

  it('overrides timeframe enum from capabilities', () => {
    const nextSchema = applyCapabilitiesToParamSchema(
      {
        type: 'object',
        required: ['symbol', 'baseTimeframe'],
        properties: {
          symbol: { type: 'string', title: 'Symbol', enum: ['BTCUSDT'] },
          baseTimeframe: { type: 'string', title: 'Base Timeframe', enum: ['30m', '1h'] },
        },
      },
      {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
    ) as Record<string, any>

    expect(nextSchema.properties.baseTimeframe.enum).toEqual(['15m'])
  })

  it('keeps strategy symbol when market symbols contain ETHUSDC but capabilities do not', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        market: {
          symbols: ['ETHUSDC'],
          timeframes: ['15m'],
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      capabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '保持策略识别出的交易对',
    })

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(result.normalized.symbol).toBe('ETHUSDC')
  })

  it('keeps the latest symbol from context when both old and new symbols appear', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
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
      capabilities: {
        allowedSymbols: ['BTCUSDT', 'ETHUSDC', 'ETHUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '把 BTCUSDT 改成 ETHUSDC',
    })

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(result.normalized.symbol).toBe('ETHUSDC')
  })

  it('keeps recognized ETHUSDC from context rules even when market symbols are BTCUSDT', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        entryRules: ['当 ETH/USDC 价格上涨到 3300 时买入'],
        exitRules: ['当 ETH/USDC 价格下跌到 3200 时卖出'],
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
      capabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '请按 ETH/USDC 重新生成策略',
    })

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(result.normalized.symbol).toBe('ETHUSDC')
  })

  it('keeps schema symbol enum aligned with current symbol when capabilities are narrower', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        entryRules: ['把 BTCUSDT 改成 ETHUSDC'],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      capabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '把 BTCUSDT 改成 ETHUSDC',
    })

    const nextSchema = applyCapabilitiesToParamSchema(
      result.paramSchema,
      {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
    ) as Record<string, any>

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(nextSchema.properties.symbol.enum).toEqual(expect.arrayContaining(['ETHUSDC']))
    expect(nextSchema.properties.symbol.enum).toEqual(expect.arrayContaining(['BTCUSDT']))
  })

  it('keeps strategy symbol inferred from context when capabilities do not include ETHUSDC', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        market: {
          symbols: [],
          timeframes: ['15m'],
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      capabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '交易标的改成 ETH/USDC，并继续执行',
    })

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(result.normalized.symbol).toBe('ETHUSDC')
  })
})
