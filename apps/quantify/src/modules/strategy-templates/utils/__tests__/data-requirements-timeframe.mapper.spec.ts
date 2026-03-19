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

  it('returns null when payload contains unsupported timeframe', () => {
    const parsed = parseDataRequirements({
      btc: ['3m'],
    })

    expect(parsed).toBeNull()
  })

  it('maps a leg data requirement into app/prisma timeframe pairs', () => {
    const mappings = mapLegDataRequirementTimeframes({
      btc: ['1h', '1d'],
    }, 'btc')

    expect(mappings).toEqual([
      { appTimeframe: '1h', prismaTimeframe: 'h1' },
      { appTimeframe: '1d', prismaTimeframe: 'd1' },
    ])
  })
})
