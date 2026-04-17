import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('accountStrategyViewController transaction boundary', () => {
  it('does not wrap deploy endpoint with controller-level transaction', () => {
    const source = readFileSync(join(__dirname, 'account-strategy-view.controller.ts'), 'utf8')

    expect(source).not.toMatch(/@Transactional\(\)\s*@Post\('deploy'\)/)
    expect(source).toMatch(/@Transactional\(\)\s*@Post\(':id\/actions'\)/)
    expect(source).toMatch(/@Transactional\(\)\s*@Post\(':id\/execution\/leverage'\)/)
    expect(source).toMatch(/@Transactional\(\)\s*@Delete\(':id'\)/)
  })
})
