import type { SemanticNaturalLanguageFrame } from '../../types/semantic-natural-language-frame'
import type { SemanticExpression } from '../../types/semantic-state'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'

describe('SemanticFrameNormalizerService', () => {
  const gateway = new NaturalLanguageGatewayService()
  const normalizer = new SemanticFrameNormalizerService()

  it('normalizes P0 natural language frames into an existing semantic patch', () => {
    const frames = gateway.parse(
      '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损',
    )
    const patch = normalizer.normalize(frames)

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'long' }),
      expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'short' }),
      expect.objectContaining({
        key: 'price.detect.indicator_boundary',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ boundaryRole: 'lower' }),
      }),
      expect.objectContaining({
        key: 'price.detect.indicator_boundary',
        phase: 'entry',
        sideScope: 'short',
        params: expect.objectContaining({ boundaryRole: 'upper' }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'open_short' }),
    ]))
    expect(patch.risk).toEqual([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
    ])
    expect(JSON.stringify(patch)).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)

    expectConditionExpression(patch.triggers?.find(
      trigger => trigger.key === 'condition.expression' && trigger.sideScope === 'long',
    )?.params?.expression, 'GT')
    expectConditionExpression(patch.triggers?.find(
      trigger => trigger.key === 'condition.expression' && trigger.sideScope === 'short',
    )?.params?.expression, 'LT')
  })

  it('splits indicator compare frames with the same group id into internally consistent gates', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      indicatorCompareFrame({ id: 'compare-long-20', operator: 'GT', sideScope: 'long', period: 20 }),
      indicatorCompareFrame({ id: 'compare-short-20', operator: 'LT', sideScope: 'short', period: 20 }),
    ]

    const patch = normalizer.normalize(frames)
    const gateTriggers = patch.triggers?.filter(trigger => trigger.key === 'condition.expression') ?? []

    expect(gateTriggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'gate', sideScope: 'long' }),
      expect.objectContaining({ phase: 'gate', sideScope: 'short' }),
    ]))
    expect(gateTriggers).toHaveLength(2)
    for (const trigger of gateTriggers) {
      const expression = trigger.params?.expression
      expect(expression).toEqual(expect.objectContaining({ kind: 'AND' }))

      if (!expression || expression.kind !== 'AND') {
        throw new Error('Expected an AND semantic expression')
      }

      for (const child of expression.children) {
        expect(child).toEqual(
          expect.objectContaining({ kind: 'predicate', op: trigger.sideScope === 'long' ? 'GT' : 'LT' }),
        )
      }
    }
  })

  it('deduplicates identical risk frames by key and params', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      riskFrame({ id: 'risk-1', valuePct: 5, evidenceText: '亏损百分5止损' }),
      riskFrame({ id: 'risk-2', valuePct: 5, evidenceText: '亏损百分5止损' }),
      riskFrame({ id: 'risk-3', valuePct: 7, evidenceText: '亏损百分7止损' }),
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.risk).toEqual([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 7 }) }),
    ])
  })

  it('uses combination frame evidence for matching compare groups', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      indicatorCompareFrame({ id: 'compare-20', operator: 'GT', sideScope: 'long', period: 20 }),
      {
        kind: 'combination',
        id: 'combination-long',
        groupId: 'mixed-gate',
        join: 'AND',
        sideScope: 'long',
        evidenceText: '价格都位于ema20上方时候只开多',
        confidence: 0.9,
      },
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.triggers?.[0]?.evidence).toEqual({
      text: '价格都位于ema20上方时候只开多',
      source: 'user_explicit',
    })
  })

  it('preserves OR combination frame semantics for indicator compare groups', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      indicatorCompareFrame({ id: 'compare-20', operator: 'GT', sideScope: 'long', period: 20 }),
      indicatorCompareFrame({ id: 'compare-60', operator: 'GT', sideScope: 'long', period: 60 }),
      {
        kind: 'combination',
        id: 'combination-long',
        groupId: 'mixed-gate',
        join: 'OR',
        sideScope: 'long',
        evidenceText: '价格位于 EMA20 或 EMA60 上方',
        confidence: 0.9,
      },
    ]

    const patch = normalizer.normalize(frames)
    const trigger = patch.triggers?.find(item => item.key === 'condition.expression')

    expect(trigger?.params?.expression).toEqual(expect.objectContaining({ kind: 'OR' }))
    expect(trigger?.params?.label).toBe('价格任一位于 EMA20、EMA60 上方')
  })

  it('normalizes a single regime_gate frame into an orchestration node patch', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      regimeGateFrame({ id: 'regime-1', sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }),
    ]

    const patch = normalizer.normalize(frames)
    const nodes = patch.orchestration?.nodes ?? []

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual(expect.objectContaining({
      id: 'orchestration-gate-regime-1',
      kind: 'gate',
      key: 'gate.regime',
      params: expect.objectContaining({ sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }),
      target: { phase: 'entry', sideScope: 'long' },
      effectWhenFalse: 'block_new_entries',
    }))
    expect(nodes[0]?.activeWhen).toEqual({
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
    })
  })

  it('produces distinct orchestration nodes for distinct regime_gate frames', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      regimeGateFrame({ id: 'regime-long', sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }),
      regimeGateFrame({ id: 'regime-short', sideScope: 'short', indicator: 'ema', period: 60, operator: 'LT' }),
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.orchestration?.nodes).toHaveLength(2)
    expect(patch.orchestration?.nodes?.map(node => node.target.sideScope)).toEqual(
      expect.arrayContaining(['long', 'short']),
    )
  })

  it('deduplicates structurally identical regime_gate frames', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      regimeGateFrame({ id: 'regime-1', sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }),
      regimeGateFrame({ id: 'regime-2', sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' }),
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.orchestration?.nodes).toHaveLength(1)
  })

  it('omits orchestration when no regime_gate frames are present', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      indicatorCompareFrame({ id: 'compare-20', operator: 'GT', sideScope: 'long', period: 20 }),
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.orchestration).toBeUndefined()
  })

  it('joins compare frame evidence when group combination evidence is unavailable', () => {
    const frames: SemanticNaturalLanguageFrame[] = [
      indicatorCompareFrame({ id: 'compare-20', operator: 'GT', sideScope: 'long', period: 20, evidenceText: 'ema20' }),
      indicatorCompareFrame({ id: 'compare-60', operator: 'GT', sideScope: 'long', period: 60, evidenceText: 'ema60' }),
    ]

    const patch = normalizer.normalize(frames)

    expect(patch.triggers?.[0]?.evidence).toEqual({
      text: 'ema20 ema60',
      source: 'user_explicit',
    })
  })
})

function expectConditionExpression(expression: SemanticExpression | undefined, op: 'GT' | 'LT'): void {
  expect(expression).toEqual(expect.objectContaining({
    kind: 'AND',
    children: expect.arrayContaining([
      emaClosePredicate(op, 20),
      emaClosePredicate(op, 60),
      emaClosePredicate(op, 144),
    ]),
  }))

  if (!expression || expression.kind !== 'AND') {
    throw new Error('Expected an AND semantic expression')
  }

  expect(expression.children).toHaveLength(3)
}

function emaClosePredicate(op: 'GT' | 'LT', period: number): object {
  return expect.objectContaining({
    kind: 'predicate',
    op,
    left: { kind: 'series', source: 'bar', field: 'close' },
    right: { kind: 'indicator', name: 'ema', params: { period } },
  })
}

function indicatorCompareFrame(input: {
  id: string
  operator: 'GT' | 'LT'
  sideScope: 'long' | 'short'
  period: number
  evidenceText?: string
}): SemanticNaturalLanguageFrame {
  return {
    kind: 'indicator_compare',
    indicator: 'ema',
    groupId: 'mixed-gate',
    confidence: 0.9,
    evidenceText: input.evidenceText ?? `ema${input.period}`,
    ...input,
  }
}

function regimeGateFrame(input: {
  id: string
  sideScope: 'long' | 'short' | 'both'
  indicator: 'ema' | 'sma' | 'ma'
  period: number
  operator: 'GT' | 'LT'
  evidenceText?: string
}): SemanticNaturalLanguageFrame {
  return {
    kind: 'regime_gate',
    confidence: 0.9,
    evidenceText: input.evidenceText ?? `${input.indicator}${input.period} ${input.operator}`,
    ...input,
  }
}

function riskFrame(input: { id: string, valuePct: number, evidenceText: string }): SemanticNaturalLanguageFrame {
  return {
    kind: 'risk',
    riskKey: 'risk.stop_loss_pct',
    confidence: 0.9,
    ...input,
  }
}
