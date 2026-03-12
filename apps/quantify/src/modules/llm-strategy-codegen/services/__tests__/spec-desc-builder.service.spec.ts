import { SpecDescBuilderService } from '../spec-desc-builder.service'

describe('specDescBuilderService', () => {
  const service = new SpecDescBuilderService()

  it('builds normalized specDesc', () => {
    const specDesc = service.build(
      {
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
      },
      'const x = helpers.ta.rsi([1,2,3], 2); return { direction: "BUY" }',
    )

    expect(specDesc.market).toMatchObject({ symbols: ['BTCUSDT'], timeframes: ['1h'] })
    expect(specDesc.features).toContain('rsi')
    expect(specDesc.constraints).toMatchObject({ allowedHelpersOnly: true })
  })
})
