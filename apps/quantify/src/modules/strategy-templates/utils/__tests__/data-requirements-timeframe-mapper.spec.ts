import {
  mapLegDataRequirementTimeframes,
  parseDataRequirements,
} from '../data-requirements-timeframe.mapper'

describe('data requirements timeframe mapper', () => {
  it('parses valid data requirements into typed object', () => {
    const parsed = parseDataRequirements({
      btc: ['1h', '4h'],
      eth: ['15m'],
    })

    expect(parsed).toEqual({
      btc: ['1h', '4h'],
      eth: ['15m'],
    })
  })

  it('parses shared market timeframes like 3m and 1w', () => {
    const parsed = parseDataRequirements({
      btc: ['3m', '1w'],
    })

    expect(parsed).toEqual({
      btc: ['3m', '1w'],
    })
  })

  it('returns null when payload contains unsupported timeframe', () => {
    const parsed = parseDataRequirements({
      btc: ['2m'],
    })

    expect(parsed).toBeNull()
  })

  it('maps a leg data requirement into app/prisma timeframe pairs', () => {
    const mappings = mapLegDataRequirementTimeframes({
      btc: ['3m', '1w'],
    }, 'btc')

    expect(mappings).toEqual([
      { appTimeframe: '3m', prismaTimeframe: 'm3' },
      { appTimeframe: '1w', prismaTimeframe: 'w1' },
    ])
  })
})
