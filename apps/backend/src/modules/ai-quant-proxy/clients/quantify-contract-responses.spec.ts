import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('quantify contract generated responses', () => {
  const generatedPath = resolve(__dirname, '../../../../../../packages/api-contracts/src/generated/quantify.ts')

  it('does not leave critical quantify aliases with z.void responses', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const aliases = [
      'AccountStrategyViewController_list',
      'AccountStrategyViewController_detail',
      'AccountStrategyViewController_action',
      'AccountStrategyViewController_deploy',
      'BacktestingController_getCapabilities',
      'BacktestingController_createJob',
      'BacktestingController_getJob',
      'BacktestingController_getJobResult',
      'BacktestingController_checkSymbolSupport',
      'PositionsController_applyQuotes',
    ]

    for (const alias of aliases) {
      const start = source.indexOf(`alias: '${alias}'`)
      expect(start).toBeGreaterThanOrEqual(0)
      const snippet = source.slice(start, start + 800)
      expect(snippet).not.toContain('response: z.void()')
    }
  })

  it('keeps nullable AI Quant codegen session fields nullable in the generated contracts', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const start = source.indexOf('const CodegenSessionResponseDto = z')

    expect(start).toBeGreaterThanOrEqual(0)

    const snippet = source.slice(start, start + 2000)
    expect(snippet).toContain('conversationId: z.string().nullish()')
    expect(snippet).toContain('scriptCode: z.string().nullish()')
    expect(snippet).toContain('publishedSnapshotId: z.string().nullish()')
    expect(snippet).toContain('publishedSnapshotParamValues: z.object({}).partial().passthrough().nullish()')
    expect(snippet).toContain('canonicalDigest: z.string().nullish()')
    expect(snippet).toContain('validationReport: z.object({}).partial().passthrough().nullish()')
    expect(snippet).toContain('strategyInstanceId: z.string().nullish()')
    expect(snippet).toContain('clarificationState: StrategyClarificationStateDto.nullish()')
    expect(snippet).toContain('publicationGate: PublicationGateDto.nullish()')
    expect(snippet).toContain('rejectReason: z.string().nullish()')
  })
})
