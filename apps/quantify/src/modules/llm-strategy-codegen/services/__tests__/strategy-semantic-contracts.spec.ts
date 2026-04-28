import {
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

  it('rejects malformed top-level semantic risk contracts without throwing', () => {
    expect(validateSemanticRiskContract(null as never)).toEqual(expect.objectContaining({ ok: false }))
    expect(validateSemanticRiskContract('risk.stop_loss_pct' as never)).toEqual(expect.objectContaining({ ok: false }))
  })
})
