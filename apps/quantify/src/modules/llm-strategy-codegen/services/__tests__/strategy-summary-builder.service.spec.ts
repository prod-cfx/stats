import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

describe('strategySummaryBuilderService', () => {
  it('extracts bollinger user intent without inventing ma defaults', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const summary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['ETHUSDT'],
        timeframes: ['1h'],
        entryRules: ['价格突破布林带上轨做空'],
        exitRules: ['回到布林带中轨平仓'],
      },
      message: '我要布林带策略，不要均线金叉那一套',
    })

    expect(summary.strategyType).toBe('bollinger')
    expect(summary.indicators).toEqual(['bollingerBands'])
    expect(summary.entryRule).toBe('bollinger.upper_break_short')
    expect(summary.exitRule).toBe('bollinger.middle_revert')
    expect(summary.indicators).not.toContain('sma')
  })

  it('builds strategy summary from canonical spec without injecting missing defaults', () => {
    const canonicalBuilder = new CanonicalSpecBuilderService()
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = canonicalBuilder.build({
      entryRules: ['价格突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    const summary = service.buildStrategySummary(spec)

    expect(summary.strategyType).toBe('custom')
    expect(summary.indicators).toEqual([])
    expect(summary.market).toEqual({})
    expect(summary.sizing).toBeNull()
  })
})
