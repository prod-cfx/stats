import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

describe('SemanticSeedExtractorService', () => {
  const service = new SemanticSeedExtractorService()

  it('extracts MA price-vs-reference semantics into a semantic patch', () => {
    const patch = service.extract('OKX 现货 BTCUSDT 15m；15m 收盘确认当价格突破 MA50 时买入；15m 收盘确认当价格跌破 MA10 时卖出；亏损 5% 止损，盈利 10% 止盈；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 10,
            confirmationMode: 'close_confirm',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5, basis: 'entry_avg_price' },
        }),
        expect.objectContaining({
          key: 'risk.take_profit_pct',
          params: { valuePct: 10, basis: 'entry_avg_price' },
        }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
  })

  it('extracts EMA price-vs-reference semantics into the existing indicator atoms', () => {
    const patch = service.extract('OKX 现货 BTCUSDT 15m；价格站上 EMA50 买入；价格跌破 EMA20 平仓；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 50,
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ema',
            referenceRole: 'long_term',
            'reference.period': 20,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
    }))
    expect(patch).not.toHaveProperty('risk')
    expect(patch).not.toHaveProperty('grid')
  })

  it('extracts EMA crossover semantics into the existing cross-over atoms', () => {
    const patch = service.extract('EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ema',
          }),
        }),
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ema',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
    }))
    expect(patch).not.toHaveProperty('contextSlots')
    expect(patch).not.toHaveProperty('risk')
    expect(patch).not.toHaveProperty('grid')
  })

  it('extracts Bollinger dual-side semantics into a semantic patch', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'bollinger.touch_upper',
          phase: 'entry',
          sideScope: 'short',
          params: expect.objectContaining({
            band: 'upper',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_lower',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            band: 'lower',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'both',
          params: expect.objectContaining({
            band: 'middle',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'open_short' }),
        expect.objectContaining({ key: 'close_long' }),
        expect.objectContaining({ key: 'close_short' }),
      ]),
      risk: [
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5, basis: 'entry_avg_price' },
        }),
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
    expect(patch.triggers?.find(trigger => trigger.key === 'bollinger.touch_middle')?.params).not.toHaveProperty('confirmationMode')
  })

  it('extracts fixed-range grid semantics into a semantic patch', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m；在 60000-80000 区间执行双向网格，步长 0.5%，单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'both',
          params: expect.objectContaining({
            rangeLower: 60000,
            rangeUpper: 80000,
            stepPct: 0.5,
            sideMode: 'bidirectional',
            recycle: true,
            breakoutAction: 'continue',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
        expect.objectContaining({ key: 'open_short' }),
        expect.objectContaining({ key: 'close_short' }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
  })

  it('keeps MA price-vs-reference periods local to each clause', () => {
    const patch = service.extract('OKX 现货 BTCUSDT 15m；突破 MA50 买入，跌破 MA10 卖出；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 50,
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 10,
          }),
        }),
      ]),
    }))
  })

  it('extracts percent-change and on-start semantics into semantic patches', () => {
    const percentChangePatch = service.extract('BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入；15m 相对开仓均价上涨 2% 时卖出；5% 止损；10% 仓位。')
    expect(percentChangePatch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        symbol: 'BTCUSDT',
        timeframe: '3m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'price.percent_change',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            valuePct: -1,
            basis: 'prev_close',
            window: '3m',
          }),
        }),
        expect.objectContaining({
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            valuePct: 2,
            basis: 'entry_avg_price',
            window: '15m',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5, basis: 'entry_avg_price' },
        }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
    }))
    expect(percentChangePatch).not.toHaveProperty('entryRules')
    expect(percentChangePatch).not.toHaveProperty('exitRules')
    expect(percentChangePatch).not.toHaveProperty('riskRules')
    expect(percentChangePatch).not.toHaveProperty('grid')

    const sizingOnlyPatch = service.extract('10% 仓位买入')
    expect(sizingOnlyPatch).not.toHaveProperty('triggers')

    const onStartPatch = service.extract('立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。')
    expect(onStartPatch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        symbol: 'BTCUSDT',
        timeframe: '1h',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'execution.on_start',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            timing: 'on_start',
            orderType: 'market',
            occurrence: 'once',
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: { valuePct: 5, basis: 'entry_avg_price' },
        }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      },
    }))
    expect(onStartPatch).not.toHaveProperty('entryRules')
    expect(onStartPatch).not.toHaveProperty('exitRules')
    expect(onStartPatch).not.toHaveProperty('riskRules')
    expect(onStartPatch).not.toHaveProperty('grid')

    const closeOnlyPatch = service.extract('立即市价平仓一次；1h；BTCUSDT；单笔 10%。')
    expect(closeOnlyPatch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'execution.on_start',
          phase: 'exit',
          sideScope: 'long',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
    expect(closeOnlyPatch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
  })

  it('does not inject Bollinger period/stdDev when the band text omits them', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m；突破布林带上轨做空；单笔 10%。')

    const upper = patch.triggers?.find(trigger => trigger.key === 'bollinger.touch_upper')
    expect(upper).toEqual(expect.objectContaining({
      key: 'bollinger.touch_upper',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({
        band: 'upper',
      }),
    }))
    expect(upper?.params).not.toHaveProperty('period')
    expect(upper?.params).not.toHaveProperty('stdDev')
  })
})
