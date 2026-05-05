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

  it.each(['确认', '可以', '好', '就这个', '先测试这个', '确认，可以等等', '可以，继续', '确认 可以等等', 'ok continue'])(
    'recognizes accept wording: %s',
    (message) => {
      expect(service.classifyConfirmation(message)).toEqual({ kind: 'accept_fallback' })
    },
  )

  it.each(['不要', '算了', '等支持再说', '不改', 'no, wait for support'])('recognizes reject wording: %s', (message) => {
    expect(service.classifyConfirmation(message)).toEqual({ kind: 'reject_fallback' })
  })

  it.each(['可以，但周期改成 1h', '可以，不过仓位 5%'])(
    'recognizes modification wording: %s',
    (message) => {
      expect(service.classifyConfirmation(message)).toEqual({
        kind: 'modify_fallback',
        message,
      })
    },
  )

  it('returns unclear for empty or ambiguous message', () => {
    expect(service.classifyConfirmation('')).toEqual({ kind: 'unclear' })
    expect(service.classifyConfirmation('再说一下')).toEqual({ kind: 'unclear' })
  })
})
