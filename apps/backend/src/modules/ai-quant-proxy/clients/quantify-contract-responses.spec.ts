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

  it('wraps exchange-account aliases in transport-envelope response schemas', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const createStart = source.indexOf(`alias: 'ExchangeAccountsController_create'`)
    const listStart = source.indexOf(`alias: 'ExchangeAccountsController_list'`)
    const deleteStart = source.indexOf(`alias: 'ExchangeAccountsController_delete'`)

    expect(createStart).toBeGreaterThanOrEqual(0)
    expect(listStart).toBeGreaterThanOrEqual(0)
    expect(deleteStart).toBeGreaterThanOrEqual(0)

    const createSnippet = source.slice(createStart, createStart + 600)
    const listSnippet = source.slice(listStart, listStart + 600)
    const deleteSnippet = source.slice(deleteStart, deleteStart + 600)

    expect(createSnippet).toContain('data: ExchangeAccountResponseDto')
    expect(createSnippet).toContain('message: z.string().optional()')
    expect(createSnippet).toContain('.passthrough()')
    expect(listSnippet).toContain('data: z.array(ExchangeAccountResponseDto)')
    expect(listSnippet).toContain('message: z.string().optional()')
    expect(listSnippet).toContain('.passthrough()')
    expect(deleteSnippet).not.toContain('response: z.void()')
    expect(deleteSnippet).toContain('data: z.null()')
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
