import type {
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticContextFrame,
  SemanticIndicatorCompareFrame,
  SemanticRiskFrame,
} from '../../types/semantic-natural-language-frame'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'

describe('NaturalLanguageGatewayService', () => {
  const service = new NaturalLanguageGatewayService()

  it('parses P0 natural language strategy text into semantic frames', () => {
    const frames = service.parse(
      '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损',
    )

    expect(contextFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'timeframe', value: '15m' }),
        expect.objectContaining({ field: 'exchange', value: 'binance' }),
        expect.objectContaining({ field: 'symbol', value: 'BTCUSDT' }),
        expect.objectContaining({ field: 'marketType', value: 'perp' }),
      ]),
    )
    expect(combinationFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: 'ema-gate-long', join: 'AND', sideScope: 'long' }),
        expect.objectContaining({ groupId: 'ema-gate-short', join: 'AND', sideScope: 'short' }),
      ]),
    )
    expect(boundaryTouchFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indicator: 'bollinger',
          boundaryRole: 'lower',
          sideScope: 'long',
          phase: 'entry',
        }),
        expect.objectContaining({
          indicator: 'bollinger',
          boundaryRole: 'upper',
          sideScope: 'short',
          phase: 'entry',
        }),
      ]),
    )
    expect(riskFrames(frames)).toEqual([
      expect.objectContaining({ riskKey: 'risk.stop_loss_pct', valuePct: 5 }),
    ])
    expect(indicatorCompareFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ indicator: 'ema', period: 20, operator: 'GT', sideScope: 'long' }),
        expect.objectContaining({ indicator: 'ema', period: 60, operator: 'GT', sideScope: 'long' }),
        expect.objectContaining({ indicator: 'ema', period: 144, operator: 'GT', sideScope: 'long' }),
        expect.objectContaining({ indicator: 'ema', period: 20, operator: 'LT', sideScope: 'short' }),
        expect.objectContaining({ indicator: 'ema', period: 60, operator: 'LT', sideScope: 'short' }),
        expect.objectContaining({ indicator: 'ema', period: 144, operator: 'LT', sideScope: 'short' }),
      ]),
    )
    expect(indicatorCompareFrames(frames)).toHaveLength(6)
  })

  it.each(['boll下轨开多', 'BOLL 下轨开多', '布林下轨开多', '布林带下轨开多'])(
    'normalizes BOLL lower-bound aliases from %s',
    input => {
      expect(boundaryTouchFrames(service.parse(input))).toEqual([
        expect.objectContaining({
          kind: 'boundary_touch',
          indicator: 'bollinger',
          boundaryRole: 'lower',
          sideScope: 'long',
          phase: 'entry',
        }),
      ])
    },
  )
})

function contextFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticContextFrame[] {
  return frames.filter(frame => frame.kind === 'context')
}

function combinationFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticCombinationFrame[] {
  return frames.filter(frame => frame.kind === 'combination')
}

function boundaryTouchFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticBoundaryTouchFrame[] {
  return frames.filter(frame => frame.kind === 'boundary_touch')
}

function riskFrames(frames: ReturnType<NaturalLanguageGatewayService['parse']>): SemanticRiskFrame[] {
  return frames.filter(frame => frame.kind === 'risk')
}

function indicatorCompareFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticIndicatorCompareFrame[] {
  return frames.filter(frame => frame.kind === 'indicator_compare')
}
