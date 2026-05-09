import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import type { SemanticState } from '../../types/semantic-state'

describe('specDescBuilderService', () => {
  const service = new SpecDescBuilderService()
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const digestService = new CanonicalSpecV2DigestService()

  it('builds rule-based specDesc summary', () => {
    const canonicalSpec = canonicalSpecBuilder.buildFromLegacyChecklistForTestsOnly({
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

  it('attaches semantic display logic graph when semanticState is provided', () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-close-gt-high',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const specDesc = service.buildFromCanonicalSpec(
      {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', defaultTimeframe: '1m' },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.03 },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { requiredTimeframes: ['1m'] },
        rules: [],
      },
      '',
      { semanticState },
    )

    expect(specDesc.displayLogicGraph).toEqual(expect.objectContaining({
      blocks: expect.arrayContaining([
        expect.objectContaining({ type: 'IF' }),
        expect.objectContaining({ type: 'EXECUTE' }),
      ]),
    }))
    expect(JSON.stringify(specDesc.displayLogicGraph)).toContain('收盘价高于前 1 根最高价')
    expect(JSON.stringify(specDesc.displayLogicGraph)).toContain('开多 3%')
  })
})
