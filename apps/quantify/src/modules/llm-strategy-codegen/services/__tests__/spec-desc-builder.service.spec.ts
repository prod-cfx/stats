import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'

describe('specDescBuilderService', () => {
  const service = new SpecDescBuilderService()
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const digestService = new CanonicalSpecV2DigestService()

  it('builds rule-based specDesc summary', () => {
    const canonicalSpec = canonicalSpecBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
      exitRules: ['价格回到布林带中轨平仓'],
      riskRules: { earlyStop: '价格连续3根K线在轨外时提前全平' },
    })
    const specDesc = service.buildFromCanonicalSpec(
      canonicalSpec,
      'const upper = 1; const lower = 2; return upper > lower',
    )

    const confirmation = specDesc.confirmation as { required?: unknown, digest?: unknown }
    const expectedDigest = digestService.hash(canonicalSpec)

    expect(specDesc.viewType).toBe('canonical-semantic-view.v1')
    expect(specDesc.version).toBe(2)
    expect(typeof specDesc.canonicalDigest).toBe('string')
    expect(specDesc.canonicalDigest).toBe(expectedDigest)
    expect(confirmation.required).toBe(true)
    expect(confirmation.digest).toBe(expectedDigest)
    expect(specDesc.market).toMatchObject({ symbols: ['BTCUSDT'], timeframes: ['15m'] })
    expect(specDesc.ruleSummary).toMatchObject({ entry: 2, exit: 1, risk: 1, total: 4 })
    expect(specDesc.summary).toContain('规则')
    expect(specDesc).not.toHaveProperty('entryRules')
    expect(specDesc).not.toHaveProperty('exitRules')
    expect(specDesc.constraints).toMatchObject({ allowedHelpersOnly: true })
  })

  it('projects semantic-view market timeframes from canonical requiredTimeframes', () => {
    const specDesc = service.buildFromCanonicalSpec({
      version: 2,
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', defaultTimeframe: '3m' },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['3m', '15m'] },
      rules: [],
    } as any, 'return strategy')

    expect(specDesc.market).toMatchObject({ timeframes: ['3m', '15m'] })
  })
})
