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
