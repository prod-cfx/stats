import { SemanticEventFrameParserService } from '../semantic-event-frame-parser.service'

describe('SemanticEventFrameParserService', () => {
  const service = new SemanticEventFrameParserService()

  it('inherits omitted moving-average operands for exit trigger wording', () => {
    const frames = service.parse('EMA7 上穿 EMA21 时开多；下穿时平多。')

    expect(frames).toEqual([
      expect.objectContaining({
        id: 'event-frame-1',
        phase: 'entry',
        sideScope: 'long',
        evidenceText: 'EMA7 上穿 EMA21 时开多',
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'over',
          semantic: 'cross_up',
          fastPeriod: 7,
          slowPeriod: 21,
        },
        action: { kind: 'open_long' },
      }),
      expect.objectContaining({
        id: 'event-frame-2',
        phase: 'exit',
        sideScope: 'long',
        evidenceText: '下穿时平多',
        inheritedFrom: 'event-frame-1',
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'under',
          semantic: 'cross_down',
          fastPeriod: 7,
          slowPeriod: 21,
        },
        action: { kind: 'close_long' },
      }),
    ])
  })

  it('splits MACD golden-cross buy and death-cross sell in one sentence', () => {
    const frames = service.parse('OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'macd',
          direction: 'over',
          semantic: 'cross_up',
        }),
        action: { kind: 'open_long' },
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'macd',
          direction: 'under',
          semantic: 'cross_down',
        }),
        action: { kind: 'close_long' },
      }),
    ])
  })

  it('splits moving-average golden-cross buy and death-cross sell in one sentence', () => {
    const frames = service.parse('EMA7 和 EMA21 金叉买入死叉卖出。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'over',
          fastPeriod: 7,
          slowPeriod: 21,
        }),
        action: { kind: 'open_long' },
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'under',
          fastPeriod: 7,
          slowPeriod: 21,
        }),
        action: { kind: 'close_long' },
      }),
    ])
  })

  it('keeps explicit short entry and short exit actions', () => {
    const frames = service.parse('EMA7 下穿 EMA21 做空；EMA7 上穿 EMA21 平空。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        action: { kind: 'open_short' },
        trigger: expect.objectContaining({ direction: 'under' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        action: { kind: 'close_short' },
        trigger: expect.objectContaining({ direction: 'over' }),
      }),
    ])
  })

  it('treats explicit sell-short wording as short entry instead of close long', () => {
    const frames = service.parse('EMA7 下穿 EMA21 卖空。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        action: { kind: 'open_short' },
        trigger: expect.objectContaining({ direction: 'under' }),
      }),
    ])
  })

  it('treats sell then open-short wording as short entry instead of close long', () => {
    const frames = service.parse('EMA7 上穿 EMA21 卖出开空。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        action: { kind: 'open_short' },
        trigger: expect.objectContaining({ direction: 'over' }),
      }),
    ])
  })

  it('inherits omitted exit from moving-average pair golden-cross wording', () => {
    const frames = service.parse('EMA7 和 EMA21 金叉开多；死叉平多。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        action: { kind: 'open_long' },
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'over',
          semantic: 'cross_up',
          fastPeriod: 7,
          slowPeriod: 21,
        },
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        action: { kind: 'close_long' },
        inheritedFrom: 'event-frame-1',
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'under',
          semantic: 'cross_down',
          fastPeriod: 7,
          slowPeriod: 21,
        },
      }),
    ])
  })
})
