import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const guardedFiles = [
  'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts',
  'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
  'apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts',
  'apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts',
]

describe('rules-only mainflow source guard', () => {
  it.each(guardedFiles)('%s keeps flat readers out of rules-only mainflow blocks', (file) => {
    const source = readFileSync(resolve(process.cwd(), '../..', file), 'utf8')
    const guardedBlocks = source
      .split('\n')
      .filter(line =>
        line.includes('RulesOnly')
        || line.includes('rules-only')
        || line.includes('RulesMainflow')
        || line.includes('buildFromRulesMainflowView'))
      .join('\n')

    expect(guardedBlocks).not.toContain('readFlatTriggers(')
    expect(guardedBlocks).not.toContain('readFlatActions(')
    expect(guardedBlocks).not.toContain('readFlatRisks(')
    expect(guardedBlocks).not.toContain('state.positionConstraint')
    expect(guardedBlocks).not.toContain('state.orchestration')
  })
})
