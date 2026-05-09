import {
  listClarificationSlotI18nTokens,
  SemanticClarificationQuestionRendererService,
} from '../semantic-clarification-question-renderer.service'

describe('SemanticClarificationQuestionRendererService', () => {
  const service = new SemanticClarificationQuestionRendererService()

  it('renders grid density slot in business language', () => {
    expect(service.render({
      slotKey: 'contract.shape.price.level_set.density',
      fallback: '请补充价格层级集合的密度或修正冲突配置。',
    })).toBe('请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。')
  })

  it('renders grid spacing conflict in business language', () => {
    expect(service.render({
      slotKey: 'contract.shape.price.level_set.spacing_conflict',
      fallback: '请补充价格层级集合的密度或修正冲突配置。',
    })).toBe('网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。')
  })

  it('renders grid level-set requirement in business language', () => {
    expect(service.render({
      slotKey: 'contract.requirement.price.define.level_set',
      fallback: '请补充 price define level_set 执行合约。',
    })).toBe('请补充网格价格区间和网格数量或每格间距。')
  })

  it('keeps existing fallback for known non-grid slots', () => {
    expect(service.render({
      slotKey: 'custom.semantic.slot',
      fallback: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
    })).toBe('请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。')
  })

  it('keeps legacy render fallback behavior even when fallback contains raw keys', () => {
    expect(service.render({
      slotKey: 'unknown.semantic.slot',
      fallback: '请补充 unknown.semantic.slot。',
    })).toBe('请补充 unknown.semantic.slot。')
  })

  it('renders position sizing from public wording instead of leaking fallback internals', () => {
    const question = service.render({
      slotKey: 'position.sizing',
      fallback: '请补充 position.sizing。',
    })

    expect(question).toMatch(/仓位|单笔|10%|USDT|BTC/u)
    expect(question).not.toContain('position.sizing')
  })

  it.each([
    [
      'trigger.percent_change.magnitude',
      '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
    ],
    [
      'trigger.confirmation.rebound_definition',
      '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。',
    ],
    [
      'trigger.confirmation.pullback_hold',
      '请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。',
    ],
    [
      'risk.falling_knife_guard.definition',
      '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
    ],
    [
      'position.sizing',
      '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
    ],
    [
      'trigger.volume.relative_average.lookback_bars',
      '请确认放量对比的均量窗口，例如过去 20 根 K 线。',
    ],
    [
      'trigger.volume.relative_average.multiplier',
      '请确认放量倍数，例如高于均量 1.5 倍。',
    ],
  ])('renders %s in business language', (slotKey, expected) => {
    expect(service.render({
      slotKey,
      fallback: 'fallback should not leak',
    })).toBe(expected)
  })

  it('renders structured Chinese copy without exposing raw slot keys in public text', () => {
    const question = service.renderStructured({
      slotKey: 'position.sizing',
      fallback: '请补充 position.sizing。',
    }, 'zh')

    expect(question).toEqual({
      title: '需要补充信息',
      question: '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
      slotLabel: '单笔仓位大小',
      examples: ['10%', '10 USDT', '0.001 BTC'],
    })
    expect(publicText(question)).not.toContain('position.sizing')
  })

  it('renders structured English copy from the i18n table', () => {
    const question = service.renderStructured({
      slotKey: 'trigger.volume.relative_average.multiplier',
      fallback: '请补充 trigger.volume.relative_average.multiplier。',
    }, 'en')

    expect(question.title).toBe('Clarification required')
    expect(question.question).toBe('Please confirm the volume multiplier, for example 1.5 times above the average volume.')
    expect(question.slotLabel).toBe('relative-volume multiplier')
    expect(question.examples).toEqual(['1.5 times above average volume'])
    expect(publicText(question)).not.toContain('trigger.volume.relative_average.multiplier')
  })

  it('uses display-registry slot tokens for structured slot labels', () => {
    expect(service.renderStructured({
      slotKey: 'volume.threshold.value',
      fallback: '请补充 volume.threshold.value。',
    }, 'zh')).toEqual({
      title: '需要补充信息',
      question: '请补充成交量阈值。',
      slotLabel: '成交量阈值',
      examples: [],
    })

    expect(service.renderStructured({
      slotKey: 'volume.threshold.value',
      fallback: 'Please provide volume.threshold.value.',
    }, 'en')).toEqual({
      title: 'Clarification required',
      question: 'Please provide the volume threshold.',
      slotLabel: 'volume threshold',
      examples: [],
    })
  })

  it('has zh/en labels for every display-registry slot token', () => {
    const tokens = listClarificationSlotI18nTokens()

    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens) {
      expect(token.slotKey).not.toMatch(/^slot\./u)
      expect(token.zh).toEqual(expect.any(String))
      expect(token.zh.trim()).not.toBe('')
      expect(token.en).toEqual(expect.any(String))
      expect(token.en.trim()).not.toBe('')
    }
  })
})

function publicText(question: {
  title: string
  question: string
  slotLabel: string
  examples: string[]
}): string {
  return [
    question.title,
    question.question,
    question.slotLabel,
    ...question.examples,
  ].join('\n')
}
