import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('backend contract generated AI Quant codegen responses', () => {
  const generatedPath = resolve(__dirname, '../../../../../../packages/api-contracts/src/generated/backend.ts')

  it('does not leave AI Quant codegen proxy aliases with z.void responses', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const aliases = [
      'LlmStrategyCodegenController_startSession',
      'LlmStrategyCodegenController_getSession',
      'LlmStrategyCodegenController_continueSession',
    ]

    for (const alias of aliases) {
      const start = source.indexOf(`alias: '${alias}'`)
      expect(start).toBeGreaterThanOrEqual(0)
      const nextAlias = source.indexOf("\n  {\n    method:", start + 1)
      const snippet = source.slice(start, nextAlias === -1 ? undefined : nextAlias)
      expect(snippet).not.toContain('response: z.void()')
    }
  })

  it('keeps account AI Quant passthrough aliases typed for list, detail, action, deploy, deployResult, and leverage-only update', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const aliases = [
      'AccountAiQuantStrategiesController_list',
      'AccountAiQuantStrategiesController_detail',
      'AccountAiQuantStrategiesController_action',
      'AccountAiQuantStrategiesController_deploy',
      'AccountAiQuantStrategiesController_deployResult',
      'AccountAiQuantStrategiesController_updateExecutionLeverage',
    ]

    for (const alias of aliases) {
      const start = source.indexOf(`alias: '${alias}'`)
      expect(start).toBeGreaterThanOrEqual(0)
      const nextAlias = source.indexOf("\n  {\n    method:", start + 1)
      const snippet = source.slice(start, nextAlias === -1 ? undefined : nextAlias)
      expect(snippet).not.toContain('response: z.void()')
    }
  })

  it('includes deployment execution config fields in backend AI Quant request contracts', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const deploySchemaStart = source.indexOf('const AccountAiQuantDeployRequestDto = z')
    const updateSchemaStart = source.indexOf('const AccountAiQuantUpdateExecutionLeverageRequestDto = z')

    expect(deploySchemaStart).toBeGreaterThanOrEqual(0)
    expect(updateSchemaStart).toBeGreaterThanOrEqual(0)

    const deploySnippet = source.slice(deploySchemaStart, deploySchemaStart + 500)
    const updateSnippet = source.slice(updateSchemaStart, updateSchemaStart + 300)

    expect(deploySnippet).toContain('deploymentExecutionConfig: z.object({}).partial().passthrough().optional()')
    expect(deploySnippet).not.toContain('strategyInstanceId')
    expect(updateSnippet).toContain('leverage: z.number()')
  })

  it('keeps backend AI Quant codegen request contracts semantic-only', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const startSchemaStart = source.indexOf('const LlmCodegenStartRequestDto = z')
    const continueSchemaStart = source.indexOf('const LlmCodegenContinueRequestDto = z')

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

  it('includes lastBacktestRef in backend AI Quant conversation response contracts', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const responseStart = source.indexOf('const AiQuantConversationResponseDto = z')
    const refStart = source.indexOf('const AiQuantConversationLastBacktestRefResponseDto = z')
    const summaryStart = source.indexOf('const AiQuantConversationLastBacktestSummaryResponseDto = z')

    expect(responseStart).toBeGreaterThanOrEqual(0)
    expect(refStart).toBeGreaterThanOrEqual(0)
    expect(summaryStart).toBeGreaterThanOrEqual(0)

    const responseSnippet = source.slice(responseStart, responseStart + 1200)
    const refSnippet = source.slice(refStart, refStart + 500)
    const summarySnippet = source.slice(summaryStart, summaryStart + 500)

    expect(responseSnippet).toContain('lastBacktestRef: AiQuantConversationLastBacktestRefResponseDto.nullish()')
    expect(refSnippet).toContain('publishedSnapshotId: z.string()')
    expect(refSnippet).toContain('summary: AiQuantConversationLastBacktestSummaryResponseDto')
    expect(refSnippet).toContain('completedAt: z.string()')
    expect(summarySnippet).toContain('maxDrawdownPct: z.number()')
    expect(summarySnippet).toContain('totalReturnPct: z.number()')
    expect(summarySnippet).toContain('winRatePct: z.number()')
    expect(summarySnippet).toContain('tradeCount: z.number()')
  })
})
