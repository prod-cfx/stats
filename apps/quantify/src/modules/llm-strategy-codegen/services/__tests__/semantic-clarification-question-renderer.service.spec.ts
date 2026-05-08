import { SemanticClarificationQuestionRendererService } from '../semantic-clarification-question-renderer.service'

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
})
