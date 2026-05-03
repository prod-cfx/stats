import {
  normalizeLegacyPositionSizing,
  resolveSemanticContract,
  validateSemanticActionContract,
  validateSemanticExpressionContract,
  validateSemanticPositionContract,
  validateSemanticRiskContract,
} from '../strategy-semantic-contracts'

describe('strategySemanticContracts', () => {
  it('requires period and confirmation mode for moving-average breakout semantics', () => {
    const contract = resolveSemanticContract('indicator.above')

    expect(contract.requiredParams).toEqual(expect.arrayContaining([
      'indicator',
      'referenceRole',
      'reference.period',
      'confirmationMode',
    ]))
  })

  it('keeps grid touch executable when range, stepPct, and sideMode are present', () => {
    const contract = resolveSemanticContract('grid_touch')

    expect(contract.requiredParams).toEqual(['range.lower', 'range.upper', 'stepPct', 'sideMode'])
    expect(contract.defaultableParams).toEqual(expect.arrayContaining(['recycle']))
  })

  it('keeps range rebalance grid aliases aligned with semantic canonical params', () => {
    const contract = resolveSemanticContract('grid.range_rebalance')

    expect(contract.requiredParams).toEqual(['rangeMin', 'rangeMax', 'stepPct'])
    expect(contract.optionalParams).toEqual(expect.arrayContaining(['sideMode', 'recycle']))
    expect(contract.editableSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'grid.range',
        valueShape: 'range',
        rangeParamPairs: expect.arrayContaining([
          ['rangeMin', 'rangeMax'],
          ['rangeLower', 'rangeUpper'],
          ['range.lower', 'range.upper'],
        ]),
      }),
      expect.objectContaining({
        slotKey: 'grid.stepPct',
        paramPaths: ['stepPct'],
      }),
    ]))
  })

  it('accepts close greater than open predicate expressions', () => {
    expect(validateSemanticExpressionContract({
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
      right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
    })).toEqual({ ok: true })
  })

  it.each(['sma', 'ema', 'rsi', 'macd'])('accepts supported %s indicator expression operands', (indicator) => {
    expect(validateSemanticExpressionContract({
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'indicator', name: indicator, params: { period: 14 }, output: 'value' },
      right: { kind: 'constant', value: 50 },
    } as never)).toEqual({ ok: true })
  })

  it.each(['atr', 'bollinger', 'custom'])('rejects unsupported %s indicator expression operands', (indicator) => {
    expect(validateSemanticExpressionContract({
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'indicator', name: indicator, params: { period: 14 }, output: 'value' },
      right: { kind: 'constant', value: 50 },
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'unsupported_indicator_name',
    }))
  })

  it('rejects BETWEEN predicate expressions until compiler support exists', () => {
    expect(validateSemanticExpressionContract({
      kind: 'predicate',
      op: 'BETWEEN',
      left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
      right: { kind: 'constant', value: 100, unit: 'price' },
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'unsupported_expression_operator',
    }))
  })

  it('rejects unsupported bar series fields', () => {
    expect(validateSemanticExpressionContract({
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'volume', offsetBars: 0 },
      right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'unsupported_series_field',
    }))
  })

  it('accepts supported semantic action contracts', () => {
    expect(validateSemanticActionContract({ key: 'open_long' })).toEqual({ ok: true })
    expect(validateSemanticActionContract({ key: 'close_long' })).toEqual({ ok: true })
  })

  it('rejects unknown semantic action contracts', () => {
    expect(validateSemanticActionContract({ key: 'unknown_action' })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'unsupported_action_key',
    }))
  })

  it('rejects malformed top-level semantic action contracts without throwing', () => {
    expect(validateSemanticActionContract(null as never)).toEqual(expect.objectContaining({ ok: false }))
    expect(validateSemanticActionContract('open_long' as never)).toEqual(expect.objectContaining({ ok: false }))
  })

  it('accepts fixed quote long-only position sizing', () => {
    expect(validateSemanticPositionContract({
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    })).toEqual({ ok: true })
  })

  it('accepts matching sizing and legacy fixed quote position contracts', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    })).toEqual({ ok: true })
  })

  it('accepts ratio, quote, and base position sizing contracts', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    }).ok).toBe(true)

    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    }).ok).toBe(true)

    expect(validateSemanticPositionContract({
      sizing: { kind: 'base', value: 0.001, asset: 'BASE' },
      mode: 'fixed_qty',
      value: 0.001,
      positionMode: 'long_only',
    }).ok).toBe(true)
  })

  it('rejects invalid position sizing contracts', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 0, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 0,
      positionMode: 'long_only',
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_position_value',
    }))

    expect(validateSemanticPositionContract({
      sizing: { kind: 'base', value: 0.001, asset: '' },
      mode: 'fixed_qty',
      value: 0.001,
      positionMode: 'long_only',
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_position_base_asset',
    }))
  })

  it('does not normalize malformed position sizing contracts', () => {
    expect(normalizeLegacyPositionSizing({
      sizing: { kind: 'quote', value: 0, asset: 'USDT' },
      positionMode: 'long_only',
    })).toBeNull()
  })

  it('rejects position contracts whose sizing conflicts with legacy mode and value', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })).toEqual({ ok: false, reason: 'position_sizing_legacy_mismatch' })

    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: -10,
      positionMode: 'long_only',
    })).toEqual({ ok: false, reason: 'invalid_position_value' })
  })

  it('accepts explicit quote assets over legacy fixed quote compatibility metadata', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USDC' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    })).toEqual({ ok: true })

    expect(validateSemanticPositionContract({
      sizing: { kind: 'quote', value: 10, asset: 'USD' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
    })).toEqual({ ok: true })
  })

  it('accepts explicit base asset sizing over the legacy fixed quantity placeholder', () => {
    expect(validateSemanticPositionContract({
      sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
      mode: 'fixed_qty',
      value: 0.001,
      positionMode: 'long_only',
    })).toEqual({ ok: true })
  })

  it('rejects malformed top-level semantic position contracts without throwing', () => {
    expect(validateSemanticPositionContract(undefined as never)).toEqual(expect.objectContaining({ ok: false }))
    expect(validateSemanticPositionContract('fixed_quote' as never)).toEqual(expect.objectContaining({ ok: false }))
  })

  it('accepts percent-based stop-loss risk contracts', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
    })).toEqual({ ok: true })
  })

  it('accepts normalized stop loss risk params with default basis metadata', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: {
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      },
    })).toEqual({ ok: true })
  })

  it('accepts explicit risk basis names used by strategy rules', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basis: 'peak_position_pnl', basisSource: 'user_explicit' },
    })).toEqual({ ok: true })
  })

  it('rejects invalid optional percent risk basis metadata', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basis: 'mark_price' },
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_basis',
    }))

    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basisSource: 'legacy' },
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_basis_source',
    }))
  })

  it('rejects percent-based risk contracts without numeric valuePct', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: {},
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_value_pct',
    }))
  })

  it('rejects percent-based risk contracts with non-positive valuePct', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: 0 },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_value_pct',
    }))
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: { valuePct: -1 },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_value_pct',
    }))
  })

  it('rejects percent-based risk contracts with missing params', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_params',
    }))
  })

  it('rejects percent-based risk contracts with non-object params', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.stop_loss_pct',
      params: null,
    } as never)).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_params',
    }))
  })

  it('accepts structured risk condition expression params as recognized unsupported', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5 },
        },
        effect: { type: 'close_position' },
        scope: 'current_position',
        capabilityStatus: 'recognized_unsupported',
        unsupportedReason: 'risk_expression_compiler_not_available',
      },
    })).toEqual({ ok: true })
  })

  it('rejects risk condition expression params without a valid expression', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: null,
        effect: { type: 'close_position' },
        scope: 'current_position',
        capabilityStatus: 'recognized_unsupported',
      },
    })).toEqual(expect.objectContaining({ ok: false }))
  })

  it('rejects risk condition expression params with invalid effect type', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5 },
        },
        effect: { type: 'liquidate_account' },
        scope: 'current_position',
        capabilityStatus: 'recognized_unsupported',
      },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_effect',
    }))
  })

  it('rejects risk condition expression params with invalid scope', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5 },
        },
        effect: { type: 'close_position' },
        scope: 'portfolio',
        capabilityStatus: 'recognized_unsupported',
      },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_scope',
    }))
  })

  it('accepts account drawdown risk condition expressions', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'account', field: 'drawdown_pct' },
          op: 'GTE',
          right: { kind: 'constant', value: 12, unit: 'percent' },
        },
        effect: { type: 'pause_strategy' },
        scope: 'account',
        capabilityStatus: 'recognized_unsupported',
        unsupportedReason: 'risk_expression_compiler_not_available',
      },
    })).toEqual({ ok: true })
  })

  it('rejects risk reduce expression params with invalid reduce percent', () => {
    expect(validateSemanticRiskContract({
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5 },
        },
        effect: { type: 'reduce_position', reducePct: 150 },
        scope: 'current_position',
        capabilityStatus: 'supported',
      },
    })).toEqual(expect.objectContaining({
      ok: false,
      reason: 'invalid_risk_reduce_pct',
    }))
  })

  it('rejects malformed top-level semantic risk contracts without throwing', () => {
    expect(validateSemanticRiskContract(null as never)).toEqual(expect.objectContaining({ ok: false }))
    expect(validateSemanticRiskContract('risk.stop_loss_pct' as never)).toEqual(expect.objectContaining({ ok: false }))
  })
})
