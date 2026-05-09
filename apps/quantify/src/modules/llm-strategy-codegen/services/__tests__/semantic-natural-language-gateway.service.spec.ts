import type {
  SemanticBoundaryTouchFrame,
  SemanticCombinationFrame,
  SemanticContextFrame,
  SemanticFixedGridGatedFrame,
  SemanticIndicatorCompareFrame,
  SemanticPortfolioDrawdownFrame,
  SemanticRegimeGateFrame,
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

  it('does not create short EMA compare frames from a different clause', () => {
    const frames = service.parse('EMA20 EMA60 上方只开多；RSI 下方只开空')

    expect(indicatorCompareFrames(frames)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 20, operator: 'GT', sideScope: 'long' }),
        expect.objectContaining({ period: 60, operator: 'GT', sideScope: 'long' }),
      ]),
    )
    expect(indicatorCompareFrames(frames).filter(frame => frame.sideScope === 'short')).toHaveLength(0)
    expect(combinationFrames(frames).filter(frame => frame.sideScope === 'short')).toHaveLength(0)
  })

  it('keeps bidirectional EMA gates scoped to their own EMA blocks', () => {
    const frames = service.parse('EMA20 EMA60 上方只开多，EMA50 EMA100 下方只开空')

    expect(indicatorCompareFrames(frames)).toEqual(expect.arrayContaining([
      expect.objectContaining({ period: 20, operator: 'GT', sideScope: 'long' }),
      expect.objectContaining({ period: 60, operator: 'GT', sideScope: 'long' }),
      expect.objectContaining({ period: 50, operator: 'LT', sideScope: 'short' }),
      expect.objectContaining({ period: 100, operator: 'LT', sideScope: 'short' }),
    ]))
    expect(indicatorCompareFrames(frames)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ period: 20, operator: 'LT', sideScope: 'short' }),
      expect.objectContaining({ period: 60, operator: 'LT', sideScope: 'short' }),
    ]))
  })

  it('does not create boundary or action frames for negated BOLL entry intent', () => {
    const frames = service.parse('BOLL 下轨不要开多')

    expect(boundaryTouchFrames(frames)).toHaveLength(0)
    expect(actionFrames(frames)).toHaveLength(0)
  })

  it('does not create action frames from ambiguous buy wording', () => {
    expect(actionFrames(service.parse('买卖规则先说明，不买入'))).toHaveLength(0)
  })

  it('does not attach global BOLL context to unrelated later boundary wording', () => {
    const frames = service.parse('使用 BOLL 观察波动；突破上边界开空')

    expect(boundaryTouchFrames(frames)).toHaveLength(0)
  })

  it('inherits explicit BOLL context into an adjacent compact boundary clause', () => {
    const frames = service.parse('BOLL下轨开多；上轨开空')

    expect(boundaryTouchFrames(frames)).toEqual(expect.arrayContaining([
      expect.objectContaining({ boundaryRole: 'lower', sideScope: 'long' }),
      expect.objectContaining({ boundaryRole: 'upper', sideScope: 'short' }),
    ]))
  })

  it('does not emit risk frames for clearly invalid stop-loss percentages', () => {
    expect(riskFrames(service.parse('亏损百分500止损'))).toHaveLength(0)
  })

  it('does not create EMA gates for negated local gate actions', () => {
    const frames = service.parse('EMA20 EMA60 上方不要开多')

    expect(indicatorCompareFrames(frames)).toHaveLength(0)
    expect(combinationFrames(frames)).toHaveLength(0)
  })

  it.each(['不要在BOLL下轨开多', '禁止当价格碰到BOLL上轨开空'])(
    'does not create boundary or action frames when clause negates %s',
    input => {
      const frames = service.parse(input)

      expect(boundaryTouchFrames(frames)).toHaveLength(0)
      expect(actionFrames(frames)).toHaveLength(0)
    },
  )

  it('keeps later compact BOLL short entry after a negated lower-bound long entry', () => {
    const frames = service.parse('BOLL下轨不要开多，上轨开空')

    expect(boundaryTouchFrames(frames)).toEqual([
      expect.objectContaining({ boundaryRole: 'upper', sideScope: 'short' }),
    ])
    expect(actionFrames(frames)).toEqual([
      expect.objectContaining({ actionKey: 'open_short' }),
    ])
  })

  it('parses long-side regime gate from "价格高于 EMA50 才允许做多"', () => {
    const frames = regimeGateFrames(service.parse('价格高于 EMA50 才允许做多'))

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'regime_gate',
        sideScope: 'long',
        indicator: 'ema',
        period: 50,
        operator: 'GT',
      }),
    ])
  })

  it('parses short-side regime gate from "价格低于 EMA60 才允许做空"', () => {
    const frames = regimeGateFrames(service.parse('价格低于 EMA60 才允许做空'))

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'regime_gate',
        sideScope: 'short',
        indicator: 'ema',
        period: 60,
        operator: 'LT',
      }),
    ])
  })

  it('does not emit regime_gate frame for "上涨趋势才允许做多" (no indicator period)', () => {
    expect(regimeGateFrames(service.parse('上涨趋势才允许做多'))).toHaveLength(0)
  })

  it('does not emit regime_gate frame for "震荡市才启用策略" (no indicator period)', () => {
    expect(regimeGateFrames(service.parse('震荡市才启用策略'))).toHaveLength(0)
  })

  it('parses enforce-mode portfolio drawdown from "账户回撤超过 10% 停止开新仓"', () => {
    const frames = portfolioDrawdownFrames(service.parse('账户回撤超过 10% 停止开新仓'))

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'portfolio_drawdown',
        thresholdPct: 10,
        mode: 'enforce',
      }),
    ])
  })

  it('parses observe-mode portfolio drawdown from "账户回撤 5% 仅记录"', () => {
    const frames = portfolioDrawdownFrames(service.parse('账户回撤 5% 仅记录'))

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'portfolio_drawdown',
        thresholdPct: 5,
        mode: 'observe',
      }),
    ])
  })

  it('parses portfolio drawdown without 账户 prefix from "回撤超过 15% 阻止开仓"', () => {
    const frames = portfolioDrawdownFrames(service.parse('回撤超过 15% 阻止开仓'))

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'portfolio_drawdown',
        thresholdPct: 15,
        mode: 'enforce',
      }),
    ])
  })

  it('does not emit portfolio_drawdown frame for vague text "感觉账户在亏"', () => {
    expect(portfolioDrawdownFrames(service.parse('感觉账户在亏'))).toHaveLength(0)
  })

  it('does not emit portfolio_drawdown frame for thresholdPct = 0', () => {
    expect(portfolioDrawdownFrames(service.parse('回撤 0% 停止开仓'))).toHaveLength(0)
  })

  it('does not emit portfolio_drawdown frame for thresholdPct > 100', () => {
    expect(portfolioDrawdownFrames(service.parse('回撤 150% 停止开仓'))).toHaveLength(0)
  })

  it('parses fixed_grid_gated frame from explicit range form with cancel-on-deactivate', () => {
    const frames = fixedGridGatedFrames(
      service.parse('BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用，停用时撤单'),
    )

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'fixed_grid_gated',
        lowerBound: 50000,
        upperBound: 60000,
        levelCount: 10,
        stepPct: 5,
        onDeactivate: 'cancel',
        activeWhenRef: 'orchestration-gate-regime-1',
        sizing: { mode: 'fixed_pct', value: 5 },
      }),
    ])
  })

  it('parses fixed_grid_gated frame from anchor form with close-on-deactivate', () => {
    const frames = fixedGridGatedFrames(
      service.parse('锚定 50000 挂 10 档网格 5% 步长 上涨时启用 失活时平仓'),
    )

    expect(frames).toEqual([
      expect.objectContaining({
        kind: 'fixed_grid_gated',
        anchorPrice: 50000,
        levelCount: 10,
        stepPct: 5,
        onDeactivate: 'close',
        activeWhenRef: 'orchestration-gate-regime-1',
      }),
    ])
  })

  it('does not emit fixed_grid_gated frame for vague text "感觉网格策略"', () => {
    expect(fixedGridGatedFrames(service.parse('感觉网格策略'))).toHaveLength(0)
  })

  it('does not emit fixed_grid_gated frame for "挂网格" without explicit parameters', () => {
    expect(fixedGridGatedFrames(service.parse('挂网格'))).toHaveLength(0)
  })

  it('keeps later explicit BOLL short entry after a negated long action segment', () => {
    const frames = service.parse('不要开多，BOLL上轨开空')

    expect(boundaryTouchFrames(frames)).toEqual([
      expect.objectContaining({ boundaryRole: 'upper', sideScope: 'short' }),
    ])
    expect(actionFrames(frames)).toEqual([
      expect.objectContaining({ actionKey: 'open_short' }),
    ])
  })
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

function actionFrames(frames: ReturnType<NaturalLanguageGatewayService['parse']>) {
  return frames.filter(frame => frame.kind === 'action')
}

function indicatorCompareFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticIndicatorCompareFrame[] {
  return frames.filter(frame => frame.kind === 'indicator_compare')
}

function regimeGateFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticRegimeGateFrame[] {
  return frames.filter(frame => frame.kind === 'regime_gate')
}

function portfolioDrawdownFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticPortfolioDrawdownFrame[] {
  return frames.filter(frame => frame.kind === 'portfolio_drawdown')
}

function fixedGridGatedFrames(
  frames: ReturnType<NaturalLanguageGatewayService['parse']>,
): SemanticFixedGridGatedFrame[] {
  return frames.filter(frame => frame.kind === 'fixed_grid_gated')
}
