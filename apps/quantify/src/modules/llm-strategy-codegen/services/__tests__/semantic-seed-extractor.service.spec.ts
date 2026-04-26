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

  it('extracts single-trade fund sizing into semantic position sizing', () => {
    const patch = service.extract('在 OKX 现货市场交易 BTCUSDT，单笔使用 10% 资金')

    expect(patch.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
  })

  it('does not lock unsupported exchanges into semantic context', () => {
    const patch = service.extract('BYBIT BTCUSDT 15m；价格上穿 MA50 买入；单笔 10%')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      timeframe: '15m',
    }))
    expect(patch.contextSlots).not.toHaveProperty('exchange')
  })

  it('normalizes lowercase full trading-pair symbols', () => {
    const patch = service.extract('okx btcusdt 15m；价格上穿 MA50 买入；单笔 10%')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
    }))
  })

  it('canonicalizes OKX swap instrument ids into strategy symbols', () => {
    const patch = service.extract('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 MA 6/48 均线交叉趋势跟随策略。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      timeframe: '15m',
    }))
  })

  it('extracts Chinese percent sizing and timeframes in deterministic seed fallback wording', () => {
    const patch = service.extract('BTCUSDT 3分钟之内跌百分1买入；15分钟之内涨百分2卖出；单笔用百分10资金')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      timeframe: '3m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: -1, window: '3m' }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: 2, window: '15m' }),
      }),
    ]))
    expect(patch.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
  })

  it('extracts unpunctuated Chinese percent-change clauses independently', () => {
    const patch = service.extract('在okx交易所 我想买BTCUSDT 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '3m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: -1, window: '3m' }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: 2, window: '15m' }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
  })

  it('extracts unpunctuated Chinese percent-change entry and exit synonyms independently', () => {
    const patch = service.extract('BTCUSDT 3分钟之内跌百分1入场 15分钟之内涨百分2出场 单笔用百分10资金')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: -1, window: '3m' }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: 2, window: '15m' }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('extracts unpunctuated Chinese open and leave synonyms with keyword-first risk percentages', () => {
    const patch = service.extract('BTCUSDT 3分钟之内跌百分1开仓 15分钟之内涨百分2离场 单笔用百分10资金 止损5% 止盈10%')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: -1, window: '3m' }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ valuePct: 2, window: '15m' }),
      }),
    ]))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
      expect.objectContaining({ key: 'risk.take_profit_pct', params: expect.objectContaining({ valuePct: 10 }) }),
    ]))
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

  it('keeps EMA crossover clauses from emitting unrelated above/below atoms', () => {
    const patch = service.extract('EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。')

    expect(patch.triggers?.map(trigger => trigger.key)).toEqual(expect.arrayContaining([
      'indicator.cross_over',
      'indicator.cross_under',
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.above' }),
      expect.objectContaining({ key: 'indicator.below' }),
    ]))
  })

  it('keeps single-reference price-vs-reference wording as above/below atoms even with crossover words', () => {
    const patch = service.extract('价格上穿 MA50 买入；单笔 10%。')

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
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
      ]),
    }))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over' }),
      expect.objectContaining({ key: 'indicator.cross_under' }),
    ]))
  })

  it('keeps mixed MA filter wording as multiple above atoms without crossover', () => {
    const patch = service.extract('价格上穿 MA50 且高于 MA200 买入；单笔 10%。')

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
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 200,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
      ]),
    }))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over' }),
      expect.objectContaining({ key: 'indicator.cross_under' }),
    ]))
  })

  it('preserves same-clause MA filters alongside true pair crossover clauses', () => {
    const patch = service.extract('MA5 上穿 MA20 且价格高于 MA200 做多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            fastPeriod: 5,
            slowPeriod: 20,
          }),
        }),
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 200,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
      ]),
    }))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_under' }),
    ]))
  })

  it('maps short crossover wording to entry and exit by intent rather than direction', () => {
    const entryPatch = service.extract('EMA7 下穿 EMA21 做空；单笔 10%。')
    expect(entryPatch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'entry',
          sideScope: 'short',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_short' }),
      ]),
    }))
    expect(entryPatch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_short' }),
    ]))

    const exitPatch = service.extract('EMA7 上穿 EMA21 平空；单笔 10%。')
    expect(exitPatch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'exit',
          sideScope: 'short',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'close_short' }),
      ]),
    }))
    expect(exitPatch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_short' }),
    ]))
  })

  it('keeps comma-separated crossover entry and exit clauses local to each clause', () => {
    const patch = service.extract('EMA7 上穿 EMA21 做多，EMA7 下穿 EMA21 平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
        }),
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
    expect(patch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_short' }),
      expect.objectContaining({ key: 'close_short' }),
    ]))
  })

  it('keeps crossover and non-crossover clauses local within the same semicolon segment', () => {
    const patch = service.extract('EMA7 上穿 EMA21 做多，价格跌破 MA50 平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 50,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
  })

  it('keeps mixed crossover and MA exit clauses local within the same semicolon segment', () => {
    const patch = service.extract('EMA7 上穿 EMA21 做多，价格下穿 MA50 平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 50,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
  })

  it('prefers explicit open-short wording over generic sell wording', () => {
    const patch = service.extract('EMA7 上穿 EMA21 卖出开空；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'short',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_short' }),
      ]),
    }))
    expect(patch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_short' }),
    ]))
  })

  it('does not emit MA or price-reference triggers for MACD金叉 wording', () => {
    const patch = service.extract('MACD 金叉做多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        params: expect.objectContaining({ indicator: 'macd' }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ params: expect.objectContaining({ indicator: 'ma' }) }),
      expect.objectContaining({ key: 'indicator.above' }),
      expect.objectContaining({ key: 'indicator.below' }),
    ]))
  })

  it('normalizes MA pair golden-cross wording into crossover atoms', () => {
    const patch = service.extract('MA5 和 MA20 金叉做多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            fastPeriod: 5,
            slowPeriod: 20,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
      ]),
    }))
  })

  it('normalizes MA pair death-cross wording into cross-under atoms', () => {
    const patch = service.extract('MA5 和 MA20 死叉平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            fastPeriod: 5,
            slowPeriod: 20,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
  })

  it('normalizes bare-number MA pair death-cross wording with extracted periods', () => {
    const patch = service.extract('5/20 均线死叉平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            fastPeriod: 5,
            slowPeriod: 20,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
  })

  it('aligns english crossover and crossunder wording with crossover atoms', () => {
    const patch = service.extract('EMA7 crossover EMA21 做多；EMA7 crossunder EMA21 平多；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
        }),
        expect.objectContaining({
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
        }),
      ]),
    }))
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

  it('respects explicit long intent for Bollinger upper-band wording', () => {
    const patch = service.extract('突破布林带上轨买入做多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'long',
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(patch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_short' }),
    ]))
  })

  it('narrows generic Bollinger middle close wording when position side is explicit', () => {
    const shortPatch = service.extract('做空时价格回到布林带中轨平仓；单笔 10%。')
    expect(shortPatch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'short',
      }),
    ]))
    expect(shortPatch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_short' }),
    ]))
    expect(shortPatch.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_long' }),
    ]))

    const longPatch = service.extract('做多时价格回到布林带中轨平仓；单笔 10%。')
    expect(longPatch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
      }),
    ]))
  })

  it('does not extract moving-average triggers from Bollinger middle-band aliases', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short' }),
      expect.objectContaining({ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long' }),
      expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'long' }),
      expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'short' }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.below' }),
    ]))
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

  it('extracts bidirectional grid semantics from range and per-grid spacing wording', () => {
    const patch = service.extract('在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'both',
        params: expect.objectContaining({
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
        }),
      }),
    ]))
  })

  it('extracts rolling range-position semantics from the official grid-range template', () => {
    const patch = service.extract('基于 OKX 模拟盘 BTC-USDT 现货 15m，创建网格区间策略。入场规则：价格位于最近 36 根 K 线区间下 20% 时买入；出场规则：价格回到区间上 55% 或盈利达到 0.45% 时卖出平仓；风控：单次仓位 25%，不使用杠杆，止损 3%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'price.range_position_lte',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            lookbackBars: 36,
            thresholdPct: 20,
          }),
        }),
        expect.objectContaining({
          key: 'price.range_position_gte',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            lookbackBars: 36,
            thresholdPct: 55,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 3 }) }),
        expect.objectContaining({ key: 'risk.take_profit_pct', params: expect.objectContaining({ valuePct: 0.45 }) }),
      ]),
      position: {
        mode: 'fixed_ratio',
        value: 0.25,
        positionMode: 'long_only',
      },
    }))
  })

  it('extracts RSI reversal semantics from the official RSI template', () => {
    const patch = service.extract('基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 反转策略。入场规则：RSI14 从 38 下方向上穿回 38 时买入；出场规则：RSI14 高于 64 时卖出平仓；风控：仓位 25%，不使用杠杆，止损 5%，止盈 0.5%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'rsi',
          period: 14,
          value: 38,
        }),
      }),
      expect.objectContaining({
        key: 'oscillator.rsi_gte',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          period: 14,
          value: 64,
        }),
      }),
    ]))
  })

  it('extracts breakout-tracking semantics from the official breakout template', () => {
    const patch = service.extract('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破追踪策略。入场规则：价格突破最近 24 根 K 线高点且突破缓冲 0.25% 时做多开仓；出场规则：价格跌回最近 12 根 K 线低点时平多；风控：仓位 25%，2 倍杠杆，止损 3%，止盈 0.6%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.breakout_up',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          period: 24,
          reference: 'channel_high',
          bufferPct: 0.25,
        }),
      }),
      expect.objectContaining({
        key: 'price.breakout_down',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          period: 12,
          reference: 'channel_low',
        }),
      }),
    ]))
  })

  it('extracts MACD DIF/DEA cross semantics from the official MACD template', () => {
    const patch = service.extract('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 金叉死叉策略。入场规则：MACD DIF 上穿 DEA 时做多开仓；出场规则：MACD DIF 下穿 DEA 时平多；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.5%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'macd',
          fastPeriod: 16,
          slowPeriod: 34,
          signalPeriod: 12,
        }),
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'macd',
          fastPeriod: 16,
          slowPeriod: 34,
          signalPeriod: 12,
        }),
      }),
    ]))
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

  it('keeps previous-close rise exit separate from stop-loss drop in the same strategy description', () => {
    const patch = service.extract(
      '在 OKX 现货 ORDIUSDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    )

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
      }),
    ]))
    const priceChangeTriggers = patch.triggers?.filter(trigger => trigger.key === 'price.percent_change') ?? []
    expect(priceChangeTriggers).toEqual([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          basis: 'prev_close',
          direction: 'up',
          valuePct: 1,
          window: '1h',
        }),
      }),
    ])
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({
          valuePct: 5,
          basis: 'entry_avg_price',
        }),
      }),
      expect.objectContaining({
        key: 'risk.take_profit_pct',
        params: expect.objectContaining({
          valuePct: 10,
          basis: 'entry_avg_price',
        }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
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
