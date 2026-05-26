import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { PlannerDispatcherMergeService } from '../../services/planner-dispatcher-merge.service'

const repoRoot = join(__dirname, '../../../../../../..')

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
})

const validRulesPatch = () => ({
  rules: [{
    id: 'rule-entry',
    phase: 'entry',
    sideScope: 'long',
    condition: atom('price.cross_over', { value: 100 }),
    effects: {
      actions: [atom('action.open_long')],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    },
    evidence: { text: 'BTCUSDT 价格上穿 100 做多' },
  }],
})

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

describe('CodegenSemanticPatch external legacy flat field gate', () => {
  const svc = new PlannerDispatcherMergeService()
  const legacyFields = [
    'atoms',
    'triggers',
    'actions',
    'risks',
    'risk',
    'position',
    'positionConstraints',
    'positionConstraint',
    'orchestration',
  ] as const

  it.each(legacyFields)('rejects semanticPatch.%s at the planner schema gate', (field) => {
    const patch = {
      ...validRulesPatch(),
      [field]: field === 'orchestration' ? { nodes: [atom('program.dynamic_grid')] } : [atom('execution.on_start')],
    }

    const result = svc.validatePlannerSemanticPatch(patch, 'BTCUSDT 价格上穿 100 做多')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('legacy_flat_field')
    }
  })

  it('keeps legacy CodegenSemanticPatch fields undeclared while raw unknown schema gate still rejects them', () => {
    const source = rg('^\\s*(atoms|triggers|actions|risks|risk|position|positionConstraints|positionConstraint|orchestration)\\??:', [
      'apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts',
    ])

    expect(source).toBe('')
    for (const field of legacyFields) {
      const result = svc.validatePlannerSemanticPatch({
        ...validRulesPatch(),
        [field]: [atom('execution.on_start')],
      }, 'BTCUSDT 价格上穿 100 做多')
      expect(result.ok).toBe(false)
    }
  })
})
