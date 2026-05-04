import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

describe('SemanticSeedExtractorService', () => {
  const service = new SemanticSeedExtractorService()

  const expectEveryExecutableSeedNodeToHaveContracts = (message: string) => {
    const patch = service.extract(message)
    const executableNodes = [
      ...(patch.triggers ?? []),
      ...(patch.actions ?? []),
      ...(patch.risk ?? []),
      ...(patch.position ? [patch.position] : []),
    ]

    expect(executableNodes.length).toBeGreaterThan(0)
    for (const node of executableNodes) {
      expect(node.contracts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: expect.any(String),
              verb: expect.any(String),
              object: expect.any(String),
              shape: expect.any(Object),
            }),
          ]),
          requires: expect.any(Array),
        }),
      ]))
    }
  }

  it('atomizes every executable seed node across representative strategy families', () => {
    const samples = [
      'BTCUSDT 1m，收盘价高于开盘价开多，收盘价低于开盘价平多，固定使用 10 USDT，止损 5%。',
      'OKX 现货 BTCUSDT 15m；价格上穿 MA50 买入；价格跌破 MA20 平仓；单笔 10%。',
      'OKX 合约 BTCUSDT 1m，使用布林带(20,2)。价格触及上轨时做空，价格触及下轨时做多；单笔仓位 10%，止盈 1%。',
      'EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。',
      'BTCUSDT 3分钟之内跌百分1买入；15分钟之内涨百分2卖出；单笔用百分10资金。',
      'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行立即停止并撤销所有未成交订单。',
      '立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。',
    ]

    for (const sample of samples) {
      expectEveryExecutableSeedNodeToHaveContracts(sample)
    }
  })

  it('extracts fixed-range grid seed contracts without percent spacing', () => {
    const patch = service.extract('OKX 现货 BTCUSDT 1m，固定区间网格价格区间 78800-81400，共 10 格，每格价格间距 260 USDT，每格下单资金 500 USDT，限价单并相邻网格自动挂反向单；当价格突破上下边界时立即停止并撤销所有未成交订单。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      timeframe: '1m',
    }))

    const gridTrigger = patch.triggers?.find(trigger => trigger.key === 'grid.range_rebalance')
    expect(gridTrigger).toEqual(expect.objectContaining({
      phase: 'entry',
      sideScope: 'long',
    }))
    expect(gridTrigger?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'trigger',
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: expect.objectContaining({
              mode: 'fixed_range',
              lower: 78800,
              upper: 81400,
              gridIntervals: 10,
              gridCount: 11,
              absoluteSpacing: 260,
              spacingMode: 'arithmetic',
            }),
          }),
        ]),
      }),
    ]))

    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'open_long',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            kind: 'action',
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
                shape: expect.objectContaining({
                  orderType: 'limit',
                  recycleOnFill: true,
                  pairingPolicy: 'adjacent_level',
                }),
              }),
              expect.objectContaining({
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: {
                  value: 500,
                  asset: 'USDT',
                },
              }),
            ]),
          }),
        ]),
      }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.boundary_guard',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            kind: 'risk',
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'guard',
                verb: 'enforce',
                object: 'boundary_cancel',
                shape: expect.objectContaining({
                  trigger: 'boundary_breach',
                  onBreach: 'HALT_STRATEGY',
                  cancelOrders: true,
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
  })

  it('extracts position sizing quote contracts from seed text', () => {
    const patch = service.extract('BTCUSDT 1m，收盘价高于开盘价开多，固定使用 10 USDT')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    }))
  })

  it('does not treat trigger quote prices as position sizing in seed text', () => {
    const patch = service.extract('BTC 跌到 60000 USDT 用 10u 开多')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    }))
  })

  it('extracts position sizing base contracts from seed text', () => {
    const patch = service.extract('BTCUSDT 1m，收盘价高于开盘价开多，每次买 0.001 BTC')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
      mode: 'fixed_qty',
      value: 0.001,
      positionMode: 'long_only',
    }))
  })

  it('normalizes english contract market wording into perp context', () => {
    const patch = service.extract('OKX BTCUSDT contract 1m，收盘价突破上一根 K 线最高价开多，单笔 3%。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '1m',
    }))
  })

  it('does not normalize contract as a substring inside unrelated english words', () => {
    const patch = service.extract('OKX BTCUSDT contractAddress 1m，收盘价突破上一根 K 线最高价开多，单笔 3%。')

    expect(patch.contextSlots).not.toHaveProperty('marketType')
  })

  it('extracts close-open candle expressions and fixed quote sizing without new normalized atom keys', () => {
    const patch = service.extract('用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多，固定使用 10 USDT。如果已有持仓则不再开仓。收盘价低于开盘价时平多。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      timeframe: '1m',
    }))
    expect(patch.contextSlots).not.toHaveProperty('exchange')
    expect(patch.contextSlots).not.toHaveProperty('marketType')
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }),
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'gate',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'EQ',
            left: { kind: 'position', field: 'has_position', side: 'long' },
            right: { kind: 'constant', value: false },
          },
        },
      }),
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'exit',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'LT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    }))
  })

  it('extracts previous bar high breakout and previous bar low breakdown expressions', () => {
    const patch = service.extract('用 BTCUSDT 1m K 线。如果最新收盘价突破上一根 K 线最高价，且当前没有持仓，则开多，使用可用余额的 3%。如果最新收盘价跌破上一根 K 线最低价，则平多。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
          },
        },
      }),
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'gate',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'EQ',
            left: { kind: 'position', field: 'has_position', side: 'long' },
            right: { kind: 'constant', value: false },
          },
        },
      }),
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'exit',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'LT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
          },
        },
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.03,
      positionMode: 'long_only',
      sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
    }))
  })

  it('inherits standalone no-position context into later entry gates', () => {
    const patch = service.extract('当前没有持仓。用 BTCUSDT 1m K 线，最新收盘价突破上一根 K 线最高价则开多，使用可用余额的 3%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'gate',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'EQ',
            left: { kind: 'position', field: 'has_position', side: 'long' },
            right: { kind: 'constant', value: false },
          },
        },
      }),
    ]))
  })

  it('does not inherit standalone no-position context into explicit existing-position entry clauses', () => {
    const patches = [
      service.extract('当前没有持仓。用 BTCUSDT 1m K 线，如果已有持仓则开多加仓，单笔 3%。'),
      service.extract('当前没有持仓。用 BTCUSDT 1m K 线，如果有持仓则开多加仓，单笔 3%。'),
      service.extract('当前没有持仓。用 BTCUSDT 1m K 线，如果持有仓位则开多加仓，单笔 3%。'),
    ]

    for (const patch of patches) {
      expect(patch.triggers).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'condition.expression',
          phase: 'gate',
          params: {
            expression: expect.objectContaining({
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            }),
          },
        }),
      ]))
    }
  })

  it('emits an open breakout trigger for undefined key reference phrases', () => {
    const patch = service.extract('突破关键位置开多，单笔 3%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.breakout_up',
        phase: 'entry',
        sideScope: 'long',
        status: 'open',
        params: expect.objectContaining({ reference: 'unknown' }),
        openSlots: [expect.objectContaining({
          slotKey: 'trigger.reference_definition',
          fieldPath: 'triggers[0].params.reference',
          status: 'open',
          priority: 'core',
          affectsExecution: true,
        })],
      }),
    ]))
  })

  it('does not emit partial breakout triggers for unrelated clauses in the same segment', () => {
    const patch = service.extract('突破关键位置开多，收盘价低于开盘价平多。')

    const openBreakoutTriggers = (patch.triggers ?? []).filter(trigger => trigger.key === 'price.breakout_up')
    expect(openBreakoutTriggers).toHaveLength(1)
    expect(openBreakoutTriggers[0]).toEqual(expect.objectContaining({
      phase: 'entry',
      sideScope: 'long',
      status: 'open',
    }))
    expect(openBreakoutTriggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'exit' }),
    ]))
  })

  it('keeps fixed quote profit targets from overriding explicit percent sizing', () => {
    const patch = service.extract('每次盈利 10 USDT 止盈；单笔 10% 仓位')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
  })

  it('keeps fixed quote risk amounts from overriding explicit percent sizing', () => {
    const patch = service.extract('单笔风险 10 USDT；单笔 10% 仓位')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
  })

  it('extracts plain stop loss with default basis metadata', () => {
    const result = service.extract('亏损 5% 止损')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      }),
    }))
  })

  it('extracts user-explicit position pnl basis metadata', () => {
    const result = service.extract('按持仓收益率盈利 10% 止盈')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({
        valuePct: 10,
        direction: 'profit',
        basis: 'position_pnl',
        basisSource: 'user_explicit',
      }),
    }))
  })

  it('extracts user-explicit entry price basis metadata', () => {
    const result = service.extract('按开仓价亏损 5% 止损')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        basis: 'entry_avg_price',
        basisSource: 'user_explicit',
      }),
    }))
  })

  it('isolates basis metadata across mixed risk clauses', () => {
    const result = service.extract('按开仓价亏损 5% 止损，按持仓收益率盈利 10% 止盈')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        basis: 'entry_avg_price',
        basisSource: 'user_explicit',
      }),
    }))
    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({
        valuePct: 10,
        basis: 'position_pnl',
        basisSource: 'user_explicit',
      }),
    }))
  })

  it('extracts advanced pnl risk as recognized unsupported condition expression', () => {
    const result = service.extract('亏损超过 5%，暂停策略')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5, unit: 'percent' },
        },
        effect: { type: 'pause_strategy' },
        scope: 'strategy',
        capabilityStatus: 'recognized_unsupported',
      }),
    }))
  })

  it('extracts simple pnl halt phrasing as recognized unsupported condition expression', () => {
    const result = service.extract('亏损 5% 停止策略')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        condition: expect.objectContaining({
          right: expect.objectContaining({ value: -5 }),
        }),
        effect: { type: 'pause_strategy' },
        scope: 'strategy',
      }),
    }))
    expect(result.risk).not.toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
    }))
  })

  it('keeps halt and stop-loss clauses separate in mixed risk wording', () => {
    const result = service.extract('亏损 5% 暂停策略，并且止损 3%')

    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        effect: { type: 'pause_strategy' },
      }),
    }))
    expect(result.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 3,
      }),
    }))
    expect(result.risk).not.toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
      }),
    }))
  })

  it('does not emit a no-position gate for ordinary open prohibitions', () => {
    const patch = service.extract('波动过大不要开仓。BTCUSDT 1m 收盘价高于开盘价时开多。')

    expect(patch.triggers ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'gate',
        key: 'condition.expression',
      }),
    ]))
  })

  it('does not turn shared 收盘价 and 开盘价 indicator comparisons into close-open expressions', () => {
    const patch = service.extract('收盘价和开盘价都高于 MA20 时买入。')

    expect(patch.triggers ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression' }),
    ]))
  })

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
          params: expect.objectContaining({ valuePct: 5, basis: 'entry_avg_price' }),
        }),
        expect.objectContaining({
          key: 'risk.take_profit_pct',
          params: expect.objectContaining({ valuePct: 10, basis: 'entry_avg_price' }),
        }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      }),
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
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      }),
    }))
    expect(patch).not.toHaveProperty('risk')
    expect(patch).not.toHaveProperty('grid')
  })

  it('extracts single-trade fund sizing into semantic position sizing', () => {
    const patch = service.extract('在 OKX 现货市场交易 BTCUSDT，单笔使用 10% 资金')

    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
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

  it('does not extract fixed quote sizing answers as trading symbols', () => {
    const patch = service.extract('1000USDT')

    expect(patch.contextSlots).toBeUndefined()
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
    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
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
    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
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
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      }),
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
          params: expect.objectContaining({ valuePct: 5, basis: 'entry_avg_price' }),
        }),
      ],
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      }),
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
    expect(patch.triggers?.find(trigger => trigger.key === 'bollinger.touch_middle')?.params).not.toHaveProperty('confirmationMode')
  })

  it('binds split Bollinger band aliases back to the declared indicator context', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(5,1)。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        timeframe: '1m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'bollinger.touch_upper',
          phase: 'entry',
          sideScope: 'short',
          params: expect.objectContaining({
            band: 'upper',
            period: 5,
            stdDev: 1,
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_lower',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            band: 'lower',
            period: 5,
            stdDev: 1,
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            band: 'middle',
            period: 5,
            stdDev: 1,
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'short',
          params: expect.objectContaining({
            band: 'middle',
            period: 5,
            stdDev: 1,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_short' }),
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
        expect.objectContaining({ key: 'close_short' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: expect.objectContaining({ valuePct: 1, basis: 'entry_avg_price' }),
        }),
        expect.objectContaining({
          key: 'risk.take_profit_pct',
          params: expect.objectContaining({ valuePct: 1.5, basis: 'entry_avg_price' }),
        }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      }),
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
    expect(patch).not.toHaveProperty('families')
    expect(patch).not.toHaveProperty('missingFields')
  })

  it('binds split Bollinger aliases from bare comma parameters', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: expect.objectContaining({
          band: 'upper',
          period: 5,
          stdDev: 1,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          band: 'lower',
          period: 5,
          stdDev: 1,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          band: 'middle',
          period: 5,
          stdDev: 1,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'short',
        params: expect.objectContaining({
          band: 'middle',
          period: 5,
          stdDev: 1,
        }),
      }),
    ]))
  })

  it('does not infer split Bollinger upper/lower aliases from side words alone', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(5,1)。上轨时做空，下轨时做多；单笔仓位 10%。')
    const triggerKeys = patch.triggers?.map(trigger => trigger.key) ?? []
    const actionKeys = patch.actions?.map(action => action.key) ?? []

    expect(triggerKeys).not.toContain('bollinger.touch_upper')
    expect(triggerKeys).not.toContain('bollinger.touch_lower')
    expect(actionKeys).not.toContain('open_short')
    expect(actionKeys).not.toContain('open_long')
  })

  it('requires explicit trade intent for split Bollinger upper/lower aliases', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(5,1)。价格触及上轨，价格跌破下轨；单笔仓位 10%。')
    const triggerKeys = patch.triggers?.map(trigger => trigger.key) ?? []

    expect(triggerKeys).not.toContain('bollinger.touch_upper')
    expect(triggerKeys).not.toContain('bollinger.touch_lower')
  })

  it('requires action semantics before extracting split Bollinger middle aliases', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(5,1)。多单在中轨时平仓，空单在中轨时平仓；单笔仓位 10%。')

    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_middle' }),
    ]))
  })

  it('requires explicit exit intent before extracting split Bollinger middle aliases', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(5,1)。价格回到中轨；单笔仓位 10%。')
    const triggerKeys = patch.triggers?.map(trigger => trigger.key) ?? []

    expect(triggerKeys).not.toContain('bollinger.touch_middle')
  })

  it('binds split Bollinger aliases to corrected parameters instead of stale ones', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，更正：布林带(20,2) 改成 布林带(5,1)。价格触及上轨时做空，价格触及下轨时做多；单笔仓位 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        params: expect.objectContaining({
          period: 5,
          stdDev: 1,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        params: expect.objectContaining({
          period: 5,
          stdDev: 1,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        params: expect.objectContaining({
          period: 20,
          stdDev: 2,
        }),
      }),
    ]))
  })

  it('binds split Bollinger aliases to corrected parameters when correction is split from the original declaration', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 1m，使用布林带(20,2)，更正：布林带(20,2) 改成 布林带(5,1)。价格触及上轨时做空，价格触及下轨时做多；单笔仓位 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        params: expect.objectContaining({
          period: 5,
          stdDev: 1,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        params: expect.objectContaining({
          period: 5,
          stdDev: 1,
        }),
      }),
    ]))
  })

  it('extracts optimized Bollinger parameters from the official reversion template', () => {
    const patch = service.extract('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建布林带均值回归策略。入场规则：价格触及布林带 30 周期 0.9 倍标准差下轨时做多开仓；出场规则：价格回归布林带中轨时平多；风控：仓位 35%，2 倍杠杆，止损 3%，止盈 0.5%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          band: 'lower',
          period: 30,
          stdDev: 0.9,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          band: 'middle',
          period: 30,
          stdDev: 0.9,
        }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
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
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      }),
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
  })

  it('extracts formatted real-grid descriptions into one centered level-set contract', () => {
    const patch = service.extract('创建一个 OKX 现货ETH/USDT 真实网格策略。 固定价格区间：以当前价格为中心，上下各 0.4%。 网格数量：10 格。 每格资金：10 USDT。 订单类型：限价单。 成交后在相邻网格自动挂反向单。 价格突破上下边界时停止并撤销未成交订单。 不要用趋势信号触发开仓，部署后立即创建网格挂单。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'long',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: expect.objectContaining({
                  mode: 'centered_percent_range',
                  halfRangePct: 0.4,
                  gridCount: 10,
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
              }),
              expect.objectContaining({
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: expect.objectContaining({ value: 10, asset: 'USDT' }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.boundary_guard' }),
    ]))
  })

  it.each([
    [
      'grid count wording',
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，做固定区间双向网格。价格区间 78800-81400，共 10 格，每格下单资金 500 USDT，部署后立即创建限价网格挂单，成交后在相邻网格自动挂反向单。',
      { gridIntervals: 10, gridCount: 11 },
    ],
    [
      'grid quantity wording',
      'OKX BTCUSDT 永续 15m，固定区间双向网格，价格区间 78800-81400，网格数量 10 个，每格下单资金 500 USDT，限价挂单成交后相邻网格反向挂单。',
      { gridCount: 10 },
    ],
    [
      'absolute spacing wording',
      'OKX BTCUSDT 永续 15m，固定区间双向网格，价格区间 78800-81400，每格价格间距 260 USDT，每格下单资金 500 USDT，限价网格挂单。',
      { absoluteSpacing: 260, gridCount: 11 },
    ],
    [
      'split range wording',
      'OKX BTCUSDT 永续 15m，固定区间 78800 到 81400，拆成 10 份，双向限价网格，每格资金 500 USDT。',
      { gridIntervals: 10, gridCount: 11 },
    ],
  ])('extracts fixed-range level-set contracts from %s', (_label, message, expectedShape) => {
    const patch = service.extract(message)

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: expect.objectContaining({
                  mode: 'fixed_range',
                  lower: 78800,
                  upper: 81400,
                  spacingMode: 'arithmetic',
                  ...expectedShape,
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
              }),
              expect.objectContaining({
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: expect.objectContaining({ value: 500, asset: 'USDT' }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
  })

  it('keeps action contracts for fixed-range grid semantics without literal grid wording', () => {
    const patch = service.extract('价格区间 78800-81400，共10格，每格下单资金 500 USDT，部署后立即创建限价挂单')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'open_long',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
              }),
              expect.objectContaining({
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: expect.objectContaining({ value: 500, asset: 'USDT' }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
  })

  it('keeps all executable atoms for the original fixed-range bidirectional grid wording', () => {
    const patch = service.extract('在 OKX 交易 BTCUSDT 永续合约，15m 周期，做固定区间双向网格。价格区间 78800-81400，共 10 格，按等距价格网格划分，每格价格间距 260 USDT，每格下单资金 500 USDT。部署后立即创建限价网格挂单，成交后在相邻网格自动挂反向单。价格突破上下边界时停止策略并撤销未成交网格订单。按入场均价亏损 5% 止损，盈利 10% 止盈。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sideScope: 'both',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: expect.objectContaining({
                  mode: 'fixed_range',
                  lower: 78800,
                  upper: 81400,
                  gridIntervals: 10,
                  gridCount: 11,
                  absoluteSpacing: 260,
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({ domain: 'order_program', verb: 'maintain', object: 'limit_ladder' }),
              expect.objectContaining({
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: expect.objectContaining({ value: 500, asset: 'USDT' }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct' }),
      expect.objectContaining({ key: 'risk.take_profit_pct' }),
      expect.objectContaining({
        key: 'risk.boundary_guard',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({ domain: 'guard', verb: 'enforce', object: 'boundary_cancel' }),
            ]),
          }),
        ]),
      }),
    ]))
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
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: expect.objectContaining({
                  lower: 60000,
                  upper: 80000,
                  spacingPct: 0.5,
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    const gridShape = patch.triggers
      ?.find(trigger => trigger.key === 'grid.range_rebalance')
      ?.contracts?.[0]?.capabilities?.find(capability => capability.object === 'level_set')
      ?.shape
    expect(gridShape).not.toHaveProperty('absoluteSpacing')
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
                shape: expect.objectContaining({
                  recycleOnFill: true,
                }),
              }),
            ]),
          }),
        ]),
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
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.25, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.25,
        positionMode: 'long_only',
      }),
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

  it('binds split MA reference aliases back to the declared moving-average context', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 MA6。价格上穿该均线做多，价格下穿该均线平多，价格下穿该均线做空；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'perp',
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
            'reference.period': 6,
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 6,
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'entry',
          sideScope: 'short',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 6,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
        expect.objectContaining({ key: 'open_short' }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      }),
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
    expect(patch).not.toHaveProperty('families')
    expect(patch).not.toHaveProperty('missingFields')
  })

  it('keeps explicit MA clauses ahead of a declared EMA alias context', () => {
    const patch = service.extract('使用 EMA6。价格突破 MA50 买入；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ma',
          'reference.period': 50,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 50,
        }),
      }),
    ]))
  })

  it('does not treat a lone MA token in a trigger clause as an alias declaration', () => {
    const patch = service.extract('价格突破 MA50 买入，价格跌破该均线卖出；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ma',
          'reference.period': 50,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.below',
        params: expect.objectContaining({
          'reference.period': 50,
        }),
      }),
    ]))
  })

  it('binds split MA aliases to corrected periods instead of stale ones', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 MA20，更正：改为 MA6。价格上穿该均线做多，价格下穿该均线平多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        params: expect.objectContaining({
          indicator: 'ma',
          'reference.period': 6,
        }),
      }),
      expect.objectContaining({
        key: 'indicator.below',
        params: expect.objectContaining({
          indicator: 'ma',
          'reference.period': 6,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        params: expect.objectContaining({
          'reference.period': 20,
        }),
      }),
    ]))
  })

  it('binds split RSI threshold aliases back to the declared oscillator context', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 RSI 9。该 RSI 小于30做多，该 RSI 大于70平多，该 RSI 大于70做空；单笔 10%。')

    expect(patch).toEqual(expect.objectContaining({
      contextSlots: expect.objectContaining({
        exchange: 'okx',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      }),
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'oscillator.rsi_lte',
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({
            period: 9,
            value: 30,
          }),
        }),
        expect.objectContaining({
          key: 'oscillator.rsi_gte',
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({
            period: 9,
            value: 70,
          }),
        }),
        expect.objectContaining({
          key: 'oscillator.rsi_gte',
          phase: 'entry',
          sideScope: 'short',
          params: expect.objectContaining({
            period: 9,
            value: 70,
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
        expect.objectContaining({ key: 'open_short' }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      }),
    }))
    expect(patch).not.toHaveProperty('entryRules')
    expect(patch).not.toHaveProperty('exitRules')
    expect(patch).not.toHaveProperty('riskRules')
    expect(patch).not.toHaveProperty('grid')
    expect(patch).not.toHaveProperty('families')
    expect(patch).not.toHaveProperty('missingFields')
  })

  it('binds split RSI aliases to corrected periods instead of stale ones', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 RSI 14，更正：改为 RSI 9。该 RSI 小于30做多，该 RSI 大于70平多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 9,
          value: 30,
        }),
      }),
      expect.objectContaining({
        key: 'oscillator.rsi_gte',
        params: expect.objectContaining({
          period: 9,
          value: 70,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 14,
        }),
      }),
    ]))
  })

  it('uses the latest RSI period when correction and trigger aliases are in the same segment', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 RSI 14，更正：改为 RSI 9，该 RSI 小于30做多，该 RSI 大于70平多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 9,
          value: 30,
        }),
      }),
      expect.objectContaining({
        key: 'oscillator.rsi_gte',
        params: expect.objectContaining({
          period: 9,
          value: 70,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 14,
        }),
      }),
    ]))
  })

  it('does not treat stale RSI periods as thresholds in same-clause corrections', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，使用 RSI 14，更正：RSI 14 改为 RSI 9 小于30做多；单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 9,
          value: 30,
        }),
      }),
    ]))
    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({
          period: 9,
          value: 14,
        }),
      }),
    ]))
  })

  it('does not treat executable RSI trigger clauses as alias declarations', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m，RSI 9 小于30做多。该 RSI 大于70平多；单笔 10%。')

    expect(patch.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_gte',
        params: expect.objectContaining({
          period: 9,
          value: 70,
        }),
      }),
    ]))
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
          params: expect.objectContaining({ valuePct: 5, basis: 'entry_avg_price' }),
        }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      }),
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
          params: expect.objectContaining({ valuePct: 5, basis: 'entry_avg_price' }),
        }),
      ]),
      position: expect.objectContaining({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
      }),
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
    expect(patch.position).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }))
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
