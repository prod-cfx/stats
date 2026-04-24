import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

describe('OfficialStrategyPlazaTemplateService', () => {
  const service = new OfficialStrategyPlazaTemplateService()

  it('returns exactly the six public beta templates in display order', () => {
    const templates = service.list()

    expect(templates.map(item => item.id)).toEqual([
      'ma-cross',
      'bollinger-reversion',
      'grid-range',
      'rsi-reversal',
      'breakout-follow',
      'macd-cross',
    ])
    expect(templates.every(item => item.exchange === 'okx')).toBe(true)
    expect(templates.every(item => item.environment === 'demo')).toBe(true)
    expect(templates.every(item => item.status === 'live')).toBe(true)
  })

  it('exposes fixed run parameters without user override fields', () => {
    const template = service.getRequired('macd-cross')

    expect(template.runConfig).toMatchObject({
      exchange: 'okx',
      symbol: expect.any(String),
      marketType: expect.stringMatching(/^(spot|perp)$/),
      timeframe: expect.any(String),
      positionPct: expect.any(Number),
    })
    expect(Object.keys(template.runConfig)).toEqual([
      'exchange',
      'marketType',
      'symbol',
      'timeframe',
      'positionPct',
      'leverage',
      'publishedSnapshotId',
      'deploymentExecutionConfig',
    ])
  })
})
