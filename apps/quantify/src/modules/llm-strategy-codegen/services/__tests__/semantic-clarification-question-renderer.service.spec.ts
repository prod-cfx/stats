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

  it('keeps existing fallback for known non-grid slots', () => {
    expect(service.render({
      slotKey: 'position.sizing',
      fallback: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
    })).toBe('请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。')
  })
})
