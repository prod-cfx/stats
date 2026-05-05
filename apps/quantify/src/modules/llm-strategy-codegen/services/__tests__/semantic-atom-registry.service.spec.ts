import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

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

  it('returns unsupported_unknown for unregistered atoms', () => {
    expect(service.resolve('custom.moon_phase')).toEqual({
      key: 'custom.moon_phase',
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    })
  })
})
