import { readFileSync } from 'node:fs'

describe('quantify contract generated responses', () => {
  const generatedPath = '/Users/a1/work/stats/packages/api-contracts/src/generated/quantify.ts'

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
    ]

    for (const alias of aliases) {
      const start = source.indexOf(`alias: '${alias}'`)
      expect(start).toBeGreaterThanOrEqual(0)
      const snippet = source.slice(start, start + 800)
      expect(snippet).not.toContain('response: z.void()')
    }
  })
})
