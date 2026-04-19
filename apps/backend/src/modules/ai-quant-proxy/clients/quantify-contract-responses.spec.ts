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
      'AccountStrategyViewController_deployResult',
      'AccountStrategyViewController_updateDeploymentLeverage',
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

  it('wraps backtesting aliases in transport-envelope response schemas', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const aliases = [
      ['BacktestingController_getCapabilities', 'data: BacktestCapabilitiesResponseDto'],
      ['BacktestingController_createJob', 'data: BacktestJobResponseDto'],
      ['BacktestingController_getJob', 'data: BacktestJobResponseDto'],
      ['BacktestingController_getJobResult', 'data: BacktestReportResponseDto'],
      ['BacktestingController_checkSymbolSupport', 'data: BacktestSymbolSupportResponseDto'],
    ] as const

    for (const [alias, dataExpectation] of aliases) {
      const start = source.indexOf(`alias: '${alias}'`)
      expect(start).toBeGreaterThanOrEqual(0)
      const snippet = source.slice(start, start + 700)
      expect(snippet).toContain(dataExpectation)
      expect(snippet).toContain('message: z.string().optional()')
      expect(snippet).toContain('.passthrough()')
    }
  })

  it('keeps generated backtesting request schemas aligned with expanded market timeframes', () => {
    const source = readFileSync(generatedPath, 'utf8')

    expect(source).toContain("baseTimeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w'])")
    expect(source).toContain("stateTimeframes: z.array(z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w']))")
    expect(source).toContain("timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w'])")
  })

  it('allows spot backtest contracts to omit request leverage and accept nullable job leverage', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const runDtoStart = source.indexOf('const RunBacktestDto = z')
    const jobSummaryStart = source.indexOf('const BacktestJobInputSummaryDto = z')

    expect(runDtoStart).toBeGreaterThanOrEqual(0)
    expect(jobSummaryStart).toBeGreaterThanOrEqual(0)

    const runDtoSnippet = source.slice(runDtoStart, runDtoStart + 500)
    const jobSummarySnippet = source.slice(jobSummaryStart, jobSummaryStart + 500)

    expect(runDtoSnippet).toContain('leverage: z.number().optional()')
    expect(jobSummarySnippet).toContain('leverage: z.number().nullish()')
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

  it('includes deployment execution config fields in quantify AI Quant request contracts', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const deploySchemaStart = source.indexOf('const AccountStrategyDeployDto = z')
    const updateSchemaStart = source.indexOf('const AccountStrategyUpdateExecutionLeverageDto = z')

    expect(deploySchemaStart).toBeGreaterThanOrEqual(0)
    expect(updateSchemaStart).toBeGreaterThanOrEqual(0)

    const deploySnippet = source.slice(deploySchemaStart, deploySchemaStart + 900)
    const updateSnippet = source.slice(updateSchemaStart, updateSchemaStart + 300)

    expect(deploySnippet).toContain('deploymentExecutionConfig: z.object({}).partial().passthrough().optional()')
    expect(updateSnippet).toContain('leverage: z.number()')
  })

  it('keeps quantify AI Quant codegen request contracts semantic-only', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const startSchemaStart = source.indexOf('const StartCodegenSessionDto = z')
    const continueSchemaStart = source.indexOf('const ContinueCodegenSessionDto = z')

    expect(startSchemaStart).toBeGreaterThanOrEqual(0)
    expect(continueSchemaStart).toBeGreaterThanOrEqual(0)

    const startSchemaEnd = source.indexOf('\nconst ', startSchemaStart + 1)
    const continueSchemaEnd = source.indexOf('\nconst ', continueSchemaStart + 1)
    const startSnippet = source.slice(startSchemaStart, startSchemaEnd === -1 ? undefined : startSchemaEnd)
    const continueSnippet = source.slice(continueSchemaStart, continueSchemaEnd === -1 ? undefined : continueSchemaEnd)

    for (const removedField of ['symbols', 'timeframes', 'entryRules', 'exitRules', 'riskRules']) {
      expect(startSnippet).not.toContain(`${removedField}:`)
      expect(continueSnippet).not.toContain(`${removedField}:`)
    }
  })
})
