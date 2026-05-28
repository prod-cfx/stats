import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = join(__dirname, '../../../../../../..')

function rg(pattern: string, paths: readonly string[]): string {
  try {
    return execFileSync('rg', ['-n', pattern, ...paths], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const status = (error as { status?: number }).status
    if (status === 1) return ''
    throw error
  }
}

describe('stage3 semantic state type surface', () => {
  it('keeps flat buckets out of the persisted SemanticState interface', () => {
    const source = rg('export interface SemanticState|export type SemanticStateBuckets|export type ProjectedFlatState|^\\s*(trigger|action|risk|positionConstraint|orchestration)\\??:', [
      'apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts',
    ])

    expect(source).not.toContain('SemanticStateBuckets')
    expect(source).not.toContain('extends SemanticStateBuckets')
    expect(source).not.toContain("Pick<SemanticState, 'trigger'")
    expect(source).not.toMatch(/^\d+:\s*(trigger|action|risk|positionConstraint|orchestration)\??:/mu)
  })

  it.each([
    'atoms',
    'triggers',
    'actions',
    'risk',
    'risks',
    'position',
    'positionConstraints',
    'positionConstraint',
    'orchestration',
  ])('keeps legacy semanticPatch.%s out of CodegenSemanticPatch', (field) => {
    const source = rg(`^\\s*${field}\\??:`, [
      'apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts',
    ])

    expect(source).toBe('')
  })
})
