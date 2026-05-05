import { SemanticEventFrameParserService } from '../semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from '../semantic-event-frame-projector.service'

describe('SemanticEventFrameProjectorService', () => {
  const parser = new SemanticEventFrameParserService()
  const service = new SemanticEventFrameProjectorService()

  it('projects inherited EMA frames into trigger and action atoms', () => {
    const frames = parser.parse('EMA7 上穿 EMA21 时开多；下穿时平多。')
    const patch = service.project(frames)

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('projects MACD one-sentence frames into separate entry and exit atoms', () => {
    const frames = parser.parse('MACD 金叉买入死叉卖出。')
    const patch = service.project(frames)

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'macd' }),
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'macd' }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })
})
