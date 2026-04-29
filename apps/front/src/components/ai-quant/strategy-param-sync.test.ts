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
    expect((result.paramSchema.properties as Record<string, any>).symbol.enum).toEqual(['BTCUSDT'])
    expect(result.executionTags).toEqual(expect.arrayContaining([
      'positionPct: 10',
      'entryPrice: 66830',
      'exitPrice: 66890',
      'maxDrawdownPct: 20',
    ]))
    expect(result.executionTags).not.toContain('backtestRangePreset: 30D')
  })

  it('keeps backtest defaults in paramValues without leaking them into execution tags', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        riskRules: { positionPct: 10 },
        market: { symbols: ['BTCUSDT'], timeframes: ['15m'] },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      currentValues: {
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      capabilities: {
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '保持 10% 仓位',
    })

    expect(result.paramValues.backtestInitialCash).toBe(10000)
    expect(result.paramValues.backtestAllowPartial).toBe(true)
    expect(result.executionTags).not.toEqual(expect.arrayContaining([
      'backtestInitialCash: 10000',
      'backtestLeverage: 1',
      'backtestAllowPartial: true',
    ]))
  })

  it('prefers canonical quote sizing over legacy positionPct', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        canonicalSpec: {
          market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '15m' },
          sizing: { mode: 'QUOTE', value: 1000 },
          rules: [{
            id: 'entry-1',
            phase: 'entry',
            condition: { kind: 'atom', key: 'price.direction', value: 'up' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'QUOTE', value: 1000 } }],
          }],
        },
        riskRules: { positionPct: 10 },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '5m',
        positionPct: 10,
        sizing: { mode: 'RATIO', value: 10 },
      },
      currentValues: {},
      capabilities: null,
    })

    expect(result.normalized.sizing).toEqual({ mode: 'QUOTE', value: 1000, asset: 'USDT' })
    expect(result.normalized.positionPct).toBe(10)
    expect(result.paramValues.sizing).toEqual({ mode: 'QUOTE', value: 1000, asset: 'USDT' })
    expect(result.paramValues.positionPct).toBeUndefined()
    expect((result.paramSchema.properties as Record<string, any>).positionAmount).toMatchObject({
      title: 'Position Amount',
      minimum: 0,
    })
  })

  it('normalizes legacy fixed sizing modes before syncing params', () => {
    const quoteResult = syncStrategyParamsFromCodegen({
      spec: {
        canonicalSpec: {
          market: { symbol: 'BTCUSDT', timeframe: '15m' },
          sizing: { mode: 'fixed_quote', value: 1000, asset: 'USDT' },
        },
        riskRules: { positionPct: 10 },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      currentValues: {},
      capabilities: null,
    })

    expect(quoteResult.normalized.sizing).toEqual({ mode: 'QUOTE', value: 1000, asset: 'USDT' })
    expect(quoteResult.paramValues.positionAmount).toBe(1000)
    expect(quoteResult.paramValues.positionPct).toBeUndefined()

    const ratioResult = syncStrategyParamsFromCodegen({
      spec: {
        rules: [{
          phase: 'entry',
          condition: { key: 'bollinger.upper_break' },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'fixed_ratio', value: 0.2 } }],
        }],
        market: { symbols: ['BTCUSDT'], timeframes: ['15m'] },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      currentValues: {},
      capabilities: null,
    })

    expect(ratioResult.normalized.sizing).toEqual({ mode: 'RATIO', value: 20 })
    expect(ratioResult.paramValues.positionPct).toBe(20)
  })

  it('uses canonical singular market fields with canonical sizing', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        canonicalSpec: {
          market: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '15m',
          },
          sizing: { mode: 'QUOTE', value: 1000 },
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '5m',
        positionPct: 10,
      },
      currentValues: {},
      capabilities: null,
    })

    expect(result.normalized.exchange).toBe('okx')
    expect(result.normalized.symbol).toBe('BTCUSDT')
    expect(result.normalized.baseTimeframe).toBe('15m')
    expect(result.paramValues.exchange).toBe('okx')
    expect(result.paramValues.symbol).toBe('BTCUSDT')
    expect(result.paramValues.baseTimeframe).toBe('15m')
    expect((result.paramSchema.properties as Record<string, any>).symbol.enum).toEqual(['BTCUSDT'])
    expect((result.paramSchema.properties as Record<string, any>).baseTimeframe.enum).toEqual(['15m'])
  })

  it('preserves current semantic quote sizing when codegen omits sizing', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        riskRules: { positionPct: 10 },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      currentValues: {
        sizing: { mode: 'QUOTE', value: 750, asset: 'USDC' },
        positionAmount: 750,
        sizingAsset: 'USDC',
      },
      capabilities: null,
    })

    expect(result.normalized.sizing).toEqual({ mode: 'QUOTE', value: 750, asset: 'USDC' })
    expect(result.paramValues.sizing).toEqual({ mode: 'QUOTE', value: 750, asset: 'USDC' })
    expect(result.paramValues.positionAmount).toBe(750)
    expect(result.paramValues.sizingAsset).toBe('USDC')
    expect(result.paramValues.positionPct).toBeUndefined()
    expect(result.executionTags).toEqual(expect.arrayContaining([
      'positionAmount: 750',
      'sizingAsset: USDC',
    ]))
    expect(result.executionTags).not.toEqual(expect.arrayContaining([
      'positionPct: 10',
      'sizing: [object Object]',
    ]))
  })

  it('preserves fallback semantic quantity sizing when codegen omits sizing', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        market: {
          symbols: ['ETHUSDT'],
          timeframes: ['15m'],
        },
        riskRules: { positionPct: 10 },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
        sizing: { mode: 'QTY', value: 0.5, asset: 'ETH' },
      },
      currentValues: {},
      capabilities: null,
    })

    expect(result.normalized.sizing).toEqual({ mode: 'QTY', value: 0.5, asset: 'ETH' })
    expect(result.paramValues.sizing).toEqual({ mode: 'QTY', value: 0.5, asset: 'ETH' })
    expect(result.paramValues.positionAmount).toBe(0.5)
    expect(result.paramValues.sizingAsset).toBe('ETH')
    expect(result.paramValues.positionPct).toBeUndefined()
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
        allowedBaseTimeframes: ['15m', '1h'],
      },
    ) as Record<string, any>

    expect(nextSchema.properties.symbol.enum).toEqual(['BTCUSDT'])
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
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '把 BTCUSDT 改成 ETHUSDC',
    })

    const nextSchema = applyCapabilitiesToParamSchema(
      result.paramSchema,
      {
        allowedBaseTimeframes: ['15m'],
      },
    ) as Record<string, any>

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(nextSchema.properties.symbol.enum).toEqual(['ETHUSDC'])
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
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '交易标的改成 ETH/USDC，并继续执行',
    })

    expect(result.paramValues.symbol).toBe('ETHUSDC')
    expect(result.normalized.symbol).toBe('ETHUSDC')
  })

  it('preserves grid-specific params and perp market intent from codegen spec', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        entryRules: ['在 60000-80000 价格区间内，当价格下跌触及网格线时买入'],
        exitRules: ['买入后当价格上涨一个网格时卖出'],
        riskRules: {
          positionPct: 10,
          marketType: 'perp',
          gridLower: 60000,
          gridUpper: 80000,
          gridCount: 20,
          gridStepPct: 1.67,
        },
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 5,
      },
      capabilities: {
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '在 OKX 的 BTCUSDT 永续上运行网格策略',
    })

    expect(result.paramValues.exchange).toBe('okx')
    expect(result.paramValues.marketType).toBe('perp')
    expect(result.paramValues.gridLower).toBe(60000)
    expect(result.paramValues.gridUpper).toBe(80000)
    expect(result.paramValues.gridCount).toBe(20)
    expect(result.paramValues.gridStepPct).toBe(1.67)
    expect((result.paramSchema.properties as Record<string, any>).marketType.title).toBe('Market Type')
  })

  it('syncs params from canonical specDesc rules and locked params', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        rules: [
          {
            phase: 'entry',
            condition: { key: 'bollinger.upper_break' },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            phase: 'entry',
            condition: { key: 'bollinger.lower_break' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            phase: 'exit',
            condition: { key: 'bollinger.middle_revert' },
            actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
          },
          {
            phase: 'risk',
            condition: { key: 'position_loss_pct', value: 0.05 },
            actions: [{ type: 'FORCE_EXIT' }],
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 10,
          stopLossPct: 5,
        },
        canonicalSpec: {
          market: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            timeframe: '15m',
            marketType: 'spot',
          },
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      capabilities: {
        allowedBaseTimeframes: ['15m', '1h'],
      },
      contextText: '在okx交易所，交易对BTCUSDT 15分钟图上，突破布林带上轨做空、突破下轨做多，仓位10%；出场条件为价格回到布林带中轨（MA20）平仓、亏损≥5%强制止损。',
    })

    expect(result.paramValues.exchange).toBe('okx')
    expect(result.paramValues.symbol).toBe('BTCUSDT')
    expect(result.paramValues.baseTimeframe).toBe('15m')
    expect(result.paramValues.positionPct).toBe(10)
    expect(result.paramValues.marketType).toBe('spot')
    expect(result.paramValues.stopLossPct).toBe(5)
  })

  it('infers exchange from assistant/context text when checklist gate specDesc has only canonical rules', () => {
    const result = syncStrategyParamsFromCodegen({
      spec: {
        rules: [
          {
            phase: 'entry',
            condition: { key: 'bollinger.upper_break' },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      capabilities: {
        allowedBaseTimeframes: ['15m'],
      },
      contextText: '策略逻辑已完整。风险规则包括交易所为OKX，仓位10%。',
    })

    expect(result.paramValues.exchange).toBe('okx')
    expect(result.normalized.exchange).toBe('okx')
  })
})
