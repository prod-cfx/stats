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
})
