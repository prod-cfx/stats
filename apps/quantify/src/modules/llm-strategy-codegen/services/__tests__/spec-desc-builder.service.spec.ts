import { SpecDescBuilderService } from '../spec-desc-builder.service'

describe('specDescBuilderService', () => {
  const service = new SpecDescBuilderService()

  it('builds rule-based specDesc summary', () => {
    const specDesc = service.build(
      {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
        exitRules: ['价格回到布林带中轨平仓'],
        riskRules: { earlyStop: '价格连续3根K线在轨外时提前全平' },
      },
      'const upper = 1; const lower = 2; return upper > lower',
    )

    expect(specDesc.version).toBe(2)
    expect(specDesc.market).toMatchObject({ symbols: ['BTCUSDT'], timeframes: ['15m'] })
    expect(specDesc.ruleSummary).toMatchObject({ entry: 2, exit: 1, risk: 1, total: 4 })
    expect(specDesc.summary).toContain('规则')
    expect(specDesc).not.toHaveProperty('entryRules')
    expect(specDesc).not.toHaveProperty('exitRules')
    expect(specDesc.constraints).toMatchObject({ allowedHelpersOnly: true })
  })
})
