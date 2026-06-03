import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { UnsupportedFallbackService } from '../unsupported-fallback.service'

describe('UnsupportedFallbackService', () => {
  const service = new UnsupportedFallbackService(new SemanticAtomRegistryService())

  it.each([
    [
      '做 Binance 和 OKX 跨所搬砖，价差大于 0.5% 时自动划转 USDT 并套利。',
      'unsupported.cross_exchange_fund_transfer_arbitrage',
      'cross_exchange_fund_transfer_arbitrage_out_of_scope',
      '目前不支持跨所搬砖套利',
    ],
    [
      '做 BTC/USDT、ETH/USDT、ETH/BTC 三角套利，盘口出现价差时自动撮合三条腿。',
      'unsupported.triangular_arbitrage_matching',
      'triangular_arbitrage_matching_out_of_scope',
      '目前不支持三角套利策略',
    ],
    [
      '做 BTCUSDT 高频做市，根据毫秒级盘口变化不断撤单挂单。',
      'unsupported.hft_market_making',
      'hft_market_making_out_of_scope',
      '目前不支持高频做市策略',
    ],
    [
      '做延迟敏感 order queue alpha，根据队列位置抢 maker 成交。',
      'unsupported.latency_sensitive_order_queue_alpha',
      'latency_sensitive_order_queue_alpha_out_of_scope',
      '目前不支持延迟敏感 order queue alpha',
    ],
  ])('builds final fail-closed unsupported prompt for C-scope: %s', (message, atomKey, reasonCode, publicText) => {
    const fallback = service.buildFinalUnsupportedFromMessage(message)

    expect(fallback).not.toBeNull()
    expect(fallback!.status).toBe('final')
    expect(fallback!.unsupportedAtoms).toEqual([expect.objectContaining({ key: atomKey, reasonCode })])
    expect(fallback!.prompt).toContain(publicText)
    expect(fallback!.prompt).not.toContain('请确认单笔仓位')
    expect(fallback).not.toHaveProperty('recommendedStrategy')
  })

  // Issue #1383 Lane A：risk.atr_stop 已升级为 supported_executable，不再走
  //   recognized_unsupported fallback 路径。下列用例改用仍为 unsupported 的
  //   volume.spike（成交量放大）作为代表性 case。
  it('builds one executable replacement prompt for unsupported atoms', () => {
    const fallback = service.buildPendingFallback([
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ])

    expect(fallback).not.toBeNull()
    expect(fallback!.prompt).toContain('我听懂了，你要的是 成交量放大')
    expect(fallback!.prompt).toContain('是否改用这个策略继续')
    const riskEffects = (fallback!.recommendedStrategy.patch.rules ?? [])
      .flatMap(rule => Array.isArray(rule.effects)
        ? rule.effects
        : [...(rule.effects.risks ?? [])])
    expect(riskEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct' }),
      expect.objectContaining({ key: 'risk.take_profit_pct' }),
    ]))
  })

  it('builds English replacement prompt for unsupported atoms', () => {
    const fallback = service.buildPendingFallback([
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ], [], 'en')

    expect(fallback).not.toBeNull()
    // Issue #1495: EN locale 也用 displayName，不漏 internal atom key（如 `volume.spike`）
    expect(fallback!.prompt).toContain('I understand you want: 成交量放大')
    expect(fallback!.prompt).not.toContain('volume.spike')
    expect(fallback!.prompt).toContain('Switch to this strategy and continue')
    expect(fallback!.prompt).not.toContain('是否改用')
    expect(fallback!.recommendedStrategy.description).toContain('Go long when MA20 crosses above MA50')
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

  it('keeps negated fallback replies with modification terms as rejection', () => {
    expect(service.classifyConfirmation('不改推荐策略，周期还是 1h')).toEqual({ kind: 'reject_fallback' })
  })

  it.each(['不可以', '还不可以', '不确认', '不好'])('does not accept negative Chinese wording: %s', (message) => {
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
    // Issue #1383 Lane A：使用仍为 unsupported 的 volume.spike 代替已升级的 atr_stop。
    const first = service.buildPendingFallback([
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ])
    const second = service.buildPendingFallback([
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ])

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    first!.recommendedStrategy.patch.risk?.push({ key: 'risk.cooldown_bars', params: { bars: 3 } })

    expect(second!.recommendedStrategy.patch.risk).not.toEqual(expect.arrayContaining([
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

    expect(fallback).not.toBeNull()
    expect(fallback!.prompt.match(/成交量放大/gu)).toHaveLength(1)
  })

  it.each([
    'data_source_missing',
    'runtime_missing_data',
    'ir_compile_missing_branch',
  ])('does not replace recognized fail-closed atom with generic fallback: %s', (reasonCode) => {
    const fallback = service.buildPendingFallback([
      {
        key: 'orderbook.imbalance',
        displayName: '盘口失衡',
        reasonCode,
        publicReason: '识别到原子，但当前执行层缺少绑定。',
      },
    ])

    expect(fallback).toBeNull()
  })

  it('returns final unsupported prompt instead of throwing when no replacement strategy exists', () => {
    const fallback = service.buildPendingFallback([
      {
        key: 'position.fixed_notional',
        displayName: '固定名义金额',
        reasonCode: 'runtime_version_unsupported',
        publicReason: '当前策略部署版本暂不支持该语义原子，请重新发布策略或改用替代方案。',
      },
    ])

    expect(fallback).not.toBeNull()
    expect(fallback!.status).toBe('final')
    expect(fallback!.prompt).toContain('固定名义金额')
    expect(fallback!.prompt).toContain('当前策略部署版本暂不支持')
    expect(fallback!.prompt).not.toContain('是否改用')
    expect(fallback).not.toHaveProperty('recommendedStrategy')
  })

  it('returns unclear for empty or ambiguous message', () => {
    expect(service.classifyConfirmation('')).toEqual({ kind: 'unclear' })
    expect(service.classifyConfirmation('再说一下')).toEqual({ kind: 'unclear' })
  })

  // Issue #1495 M2: zh locale 缺失 displayName 兜底
  describe('#1495-M2 zh locale displayName 缺失兜底', () => {
    it('displayName = undefined → zh prompt 含「未支持的功能」兜底，不含 undefined 字面量', () => {
      const fallback = service.buildPendingFallback([
        {
          key: 'volume.spike',
          displayName: undefined as unknown as string,
          reasonCode: 'volume_condition_public_beta_unsupported',
          publicReason: '成交量条件当前公测暂未支持生成和回测。',
        },
      ], [], 'zh')
      expect(fallback).not.toBeNull()
      expect(fallback!.prompt).toContain('未支持的功能')
      expect(fallback!.prompt).not.toContain('undefined')
      expect(fallback!.prompt).not.toContain('volume.spike')
    })

    it('displayName = "" → zh prompt 走「未支持的功能」兜底，不出现空名字', () => {
      const fallback = service.buildPendingFallback([
        {
          key: 'volume.spike',
          displayName: '',
          reasonCode: 'volume_condition_public_beta_unsupported',
          publicReason: '成交量条件当前公测暂未支持生成和回测。',
        },
      ], [], 'zh')
      expect(fallback).not.toBeNull()
      expect(fallback!.prompt).toContain('未支持的功能')
      // 防退化：避免「我听懂了，你要的是 。」这种空名字句式
      expect(fallback!.prompt).not.toMatch(/你要的是\s*。/u)
      expect(fallback!.prompt).not.toContain('volume.spike')
    })

    it('displayName = "   "（全空白）→ trim 后视为空，走「未支持的功能」兜底', () => {
      const fallback = service.buildPendingFallback([
        {
          key: 'volume.spike',
          displayName: '   ',
          reasonCode: 'volume_condition_public_beta_unsupported',
          publicReason: '成交量条件当前公测暂未支持生成和回测。',
        },
      ], [], 'zh')
      expect(fallback).not.toBeNull()
      expect(fallback!.prompt).toContain('未支持的功能')
    })
  })
})
