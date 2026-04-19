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

  it('keeps account AI Quant passthrough aliases typed for detail, deploy, and leverage-only update', () => {
    const source = readFileSync(generatedPath, 'utf8')
    const aliases = [
      'AccountAiQuantStrategiesController_detail',
      'AccountAiQuantStrategiesController_deploy',
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

  it('includes leverage passthrough fields in backend AI Quant request contracts', () => {
    const source = readFileSync(generatedPath, 'utf8')

    const deploySchemaStart = source.indexOf('const AccountAiQuantDeployRequestDto = z')
    const updateSchemaStart = source.indexOf('const AccountAiQuantUpdateExecutionLeverageRequestDto = z')

    expect(deploySchemaStart).toBeGreaterThanOrEqual(0)
    expect(updateSchemaStart).toBeGreaterThanOrEqual(0)

    const deploySnippet = source.slice(deploySchemaStart, deploySchemaStart + 500)
    const updateSnippet = source.slice(updateSchemaStart, updateSchemaStart + 300)

    expect(deploySnippet).toContain('leverage: z.number().optional()')
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
})
