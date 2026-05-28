import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

describe('SemanticSeedExtractorService rules sideScope binding', () => {
  it('keeps lower-band long and upper-band short actions on their own rules', () => {
    const patch = new SemanticSeedExtractorService().extract(
      'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空',
    )

    const lowerRules = patch.rules?.filter(rule =>
      rule.condition.kind === 'atom'
      && rule.condition.key === 'price.detect.indicator_boundary'
      && rule.condition.params.boundaryRole === 'lower',
    ) ?? []
    const upperRules = patch.rules?.filter(rule =>
      rule.condition.kind === 'atom'
      && rule.condition.key === 'price.detect.indicator_boundary'
      && rule.condition.params.boundaryRole === 'upper',
    ) ?? []

    expect(lowerRules.length).toBeGreaterThan(0)
    expect(upperRules.length).toBeGreaterThan(0)
    expect(lowerRules.every(rule =>
      rule.effects.actions.every(action => action.key === 'action.open_long'),
    )).toBe(true)
    expect(upperRules.every(rule =>
      rule.effects.actions.every(action => action.key === 'action.open_short'),
    )).toBe(true)
  })

  it('keeps DCA schedule constraints in rules-only position effects', () => {
    const patch = new SemanticSeedExtractorService().extract(
      'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT',
    )

    const dcaEffects = patch.rules?.flatMap(rule =>
      rule.effects.positions.filter(effect => effect.key === 'position.dca_schedule'),
    ) ?? []

    expect(dcaEffects).toEqual([
      expect.objectContaining({
        key: 'position.dca_schedule',
        params: expect.objectContaining({
          perOrderSizing: expect.objectContaining({ value: 100 }),
          triggerMode: 'time_interval',
        }),
      }),
    ])
  })

  it('keeps portfolio drawdown orchestration without creating an unconditional entry action', () => {
    const patch = new SemanticSeedExtractorService().extract(
      'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断。',
    )

    const drawdownRules = patch.rules?.filter(rule =>
      rule.effects.orchestration.some(effect => effect.key === 'portfolioRisk.drawdown_block'),
    ) ?? []
    const onStartOpenRules = patch.rules?.filter(rule =>
      rule.condition.kind === 'atom'
      && rule.condition.key === 'execution.on_start'
      && rule.effects.actions.some(action => action.key === 'action.open_long'),
    ) ?? []

    expect(drawdownRules).toEqual([
      expect.objectContaining({
        effects: expect.objectContaining({
          orchestration: [
            expect.objectContaining({
              key: 'portfolioRisk.drawdown_block',
              params: expect.objectContaining({ thresholdPct: 15 }),
            }),
          ],
        }),
      }),
    ])
    expect(onStartOpenRules).toEqual([])
  })
})
