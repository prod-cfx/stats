import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { UnsupportedFallbackService } from '../unsupported-fallback.service'

describe('UnsupportedFallbackService', () => {
  const service = new UnsupportedFallbackService(new SemanticAtomRegistryService())

  it('builds one executable replacement prompt for unsupported atoms', () => {
    const fallback = service.buildPendingFallback([
      {
        key: 'risk.atr_stop',
        displayName: 'ATR 动态止损',
        reasonCode: 'atr_stop_public_beta_unsupported',
        publicReason: 'ATR 动态止损当前公测暂未支持生成和回测。',
      },
    ])

    expect(fallback.prompt).toContain('我听懂了，你要的是 ATR 动态止损')
    expect(fallback.prompt).toContain('是否改用这个策略继续')
    expect(fallback.recommendedStrategy.patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct' }),
      expect.objectContaining({ key: 'risk.take_profit_pct' }),
    ]))
  })

  it.each(['确认', '可以', '好', '就这个', '先测试这个', '确认，可以等等', '可以，继续', '确认 可以等等', 'ok continue', 'no problem, yes'])(
    'recognizes accept wording: %s',
    (message) => {
      expect(service.classifyConfirmation(message)).toEqual({ kind: 'accept_fallback' })
    },
  )

  it.each(['不要', '算了', '等支持再说', '不改', 'no, wait for support', 'nope'])('recognizes reject wording: %s', (message) => {
    expect(service.classifyConfirmation(message)).toEqual({ kind: 'reject_fallback' })
  })

  it.each(['不可以', '还不可以', '不确认'])('does not accept negative Chinese wording: %s', (message) => {
    expect(service.classifyConfirmation(message)).toEqual({ kind: 'reject_fallback' })
  })

  it.each(['周期改成 1h', '仓位 5%', 'symbol change to ETHUSDT'])(
    'recognizes pure modification wording: %s',
    (message) => {
      expect(service.classifyConfirmation(message)).toEqual({ kind: 'modify_fallback', message })
    },
  )

  it.each(['可以，但周期改成 1h', '可以，不过仓位 5%', '可以，但不改仓位', '可以，但是不要改周期'])(
    'recognizes modification wording: %s',
    (message) => {
      expect(service.classifyConfirmation(message)).toEqual({
        kind: 'modify_fallback',
        message,
      })
    },
  )

  it('does not mutate registry replacement when fallback patch is mutated by caller', () => {
    const first = service.buildPendingFallback([
      {
        key: 'risk.atr_stop',
        displayName: 'ATR 动态止损',
        reasonCode: 'atr_stop_public_beta_unsupported',
        publicReason: 'ATR 动态止损当前公测暂未支持生成和回测。',
      },
    ])
    const second = service.buildPendingFallback([
      {
        key: 'risk.atr_stop',
        displayName: 'ATR 动态止损',
        reasonCode: 'atr_stop_public_beta_unsupported',
        publicReason: 'ATR 动态止损当前公测暂未支持生成和回测。',
      },
    ])

    first.recommendedStrategy.patch.risk?.push({ key: 'risk.cooldown_bars', params: { bars: 3 } })

    expect(second.recommendedStrategy.patch.risk).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.cooldown_bars' }),
    ]))
  })

  it('dedupes unsupported atom names in prompt', () => {
    const fallback = service.buildPendingFallback([
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ])

    expect(fallback.prompt.match(/成交量放大/gu)).toHaveLength(1)
  })

  it('returns unclear for empty or ambiguous message', () => {
    expect(service.classifyConfirmation('')).toEqual({ kind: 'unclear' })
    expect(service.classifyConfirmation('再说一下')).toEqual({ kind: 'unclear' })
  })
})
