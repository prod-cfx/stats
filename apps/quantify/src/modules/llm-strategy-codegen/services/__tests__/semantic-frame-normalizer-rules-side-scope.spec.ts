import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'

describe('SemanticFrameNormalizerService rules sideScope binding', () => {
  it('keeps lower-band long and upper-band short actions on their own rules', () => {
    const frames = new NaturalLanguageGatewayService().parse(
      '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损',
    )
    const patch = new SemanticFrameNormalizerService().normalize(frames)

    const lowerRule = patch.rules?.find(rule =>
      rule.condition.kind === 'atom'
      && rule.condition.key === 'price.detect.indicator_boundary'
      && rule.condition.params.boundaryRole === 'lower',
    )
    const upperRule = patch.rules?.find(rule =>
      rule.condition.kind === 'atom'
      && rule.condition.key === 'price.detect.indicator_boundary'
      && rule.condition.params.boundaryRole === 'upper',
    )

    expect(lowerRule?.effects.actions).toEqual([
      expect.objectContaining({ key: 'action.open_long' }),
    ])
    expect(upperRule?.effects.actions).toEqual([
      expect.objectContaining({ key: 'action.open_short' }),
    ])
  })
})
