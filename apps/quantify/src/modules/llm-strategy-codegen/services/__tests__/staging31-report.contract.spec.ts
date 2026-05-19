import { assertStaging31ReportShape, hasUiAstScriptMismatch, listStaging31Cases, parseArgs, type Staging31CaseReport } from '../../scripts/staging31-hard-gate-report'

describe('staging31 hard gate report contract', () => {
  it('contains all 31 cases', () => {
    expect(listStaging31Cases()).toHaveLength(31)
  })

  it('requires full pipeline fields', () => {
    const report: Staging31CaseReport = {
      index: 1,
      input: 'x',
      assistantResponse: 'x',
      rulesTree: {},
      projectedFlat: {},
      contextPositionRisk: {},
      clarification: {},
      readiness: {},
      uiSummaryOrGraph: {},
      canonicalSpec: {},
      ir: {},
      ast: {},
      scriptOrError: {},
      result: 'pass',
      failures: [],
    }

    expect(() => assertStaging31ReportShape(report)).not.toThrow()
  })

  it('rejects production entry runs', () => {
    expect(() => parseArgs(['--env', 'production'])).toThrow('production_entry_source_forbidden')
    expect(parseArgs(['--env', 'production', '--source', 'db'])).toEqual(expect.objectContaining({
      env: 'production',
      source: 'db',
    }))
  })

  it('detects UI, AST, and script action mismatch', () => {
    const matched = {
      rulesTree: [{ effects: [{ key: 'action.open_long' }] }],
      uiSummaryOrGraph: {
        graph: {
          blocks: [{ items: [{ kind: 'action', text: '开多' }] }],
        },
      },
      ast: {
        decisionPrograms: [{ actions: [{ kind: 'OPEN_LONG' }] }],
        guards: [],
      },
      scriptOrError: { script: "return { action: 'OPEN_LONG' }" },
    }
    expect(hasUiAstScriptMismatch(matched)).toBe(false)

    expect(hasUiAstScriptMismatch({
      ...matched,
      ast: {
        decisionPrograms: [{ actions: [{ kind: 'OPEN_SHORT' }] }],
        guards: [],
      },
      scriptOrError: { script: "return { action: 'OPEN_SHORT' }" },
    })).toBe(true)
  })
})
