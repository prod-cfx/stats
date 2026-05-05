import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('SemanticAtomRegistryService', () => {
  const service = new SemanticAtomRegistryService()

  it('classifies executable indicator and price atoms without strategy family authority', () => {
    expect(service.get('indicator.cross_over')).toMatchObject({
      key: 'indicator.cross_over',
      category: 'trigger',
      supportStatus: 'supported_executable',
    })
    expect(service.get('price.range_position_lte')).toMatchObject({
      key: 'price.range_position_lte',
      category: 'trigger',
      supportStatus: 'supported_executable',
    })
  })

  it('recognizes mainstream unsupported atoms with user-facing fallback metadata', () => {
    expect(service.get('volume.spike')).toMatchObject({
      key: 'volume.spike',
      category: 'trigger',
      supportStatus: 'recognized_unsupported',
      unsupported: {
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
      },
      replacement: {
        strategyKey: 'price_breakout_with_fixed_risk',
      },
    })
    expect(service.get('risk.atr_stop')).toMatchObject({
      key: 'risk.atr_stop',
      category: 'risk',
      supportStatus: 'recognized_unsupported',
      unsupported: {
        displayName: 'ATR 动态止损',
        reasonCode: 'atr_stop_public_beta_unsupported',
      },
    })
  })

  it('does not classify aliases or compiler-unsupported atoms as executable projection atoms', () => {
    for (const key of ['market.trend', 'market.range', 'indicator.above', 'indicator.below']) {
      expect(service.get(key)).toMatchObject({
        key,
        category: 'trigger',
        supportStatus: 'recognized_unsupported',
      })
      expect(service.get(key).executableProjection).toEqual([])
    }
  })

  it('classifies current executable trigger atoms as supported executable', () => {
    const executableKeys = [
      'price.percent_change',
      'price.detect.indicator_boundary',
      'bollinger.touch_upper',
      'bollinger.touch_lower',
      'bollinger.touch_middle',
      'oscillator.rsi_gte',
      'oscillator.rsi_lte',
      'trend.direction',
      'market.regime',
      'volatility.state',
    ]

    for (const key of executableKeys) {
      expect(service.get(key)).toMatchObject({
        key,
        category: 'trigger',
        supportStatus: 'supported_executable',
      })
    }
  })

  it('provides a fallback patch that closes trigger contracts in the current semantic builder', () => {
    const replacement = service.get('risk.atr_stop').replacement
    expect(replacement?.description).toBe('MA20 上穿 MA50 开多，MA20 下穿 MA50 平仓，5% 止损，10% 止盈，单笔 10% 仓位。')

    const state = new SemanticSeedStateBuilderService().build(replacement?.patch)

    expect(state?.triggers).toHaveLength(2)
    expect(state?.triggers).toEqual([
      expect.objectContaining({
        key: 'indicator.cross_over',
        contracts: expect.any(Array),
        openSlots: [],
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        contracts: expect.any(Array),
        openSlots: [],
      }),
    ])
  })

  it('returns unsupported_unknown for unregistered atoms', () => {
    expect(service.resolve('custom.moon_phase')).toEqual({
      key: 'custom.moon_phase',
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    })
  })
})
