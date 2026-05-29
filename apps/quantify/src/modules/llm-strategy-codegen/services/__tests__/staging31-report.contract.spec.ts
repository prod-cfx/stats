import { assertStaging31ReportShape, hasUiAstScriptMismatch, inferClarificationAnswer, isStaging31HardGatePassing, listStaging31Cases, parseArgs, type Staging31CaseReport } from '../../scripts/staging31-hard-gate-report'

describe('staging31 hard gate report contract', () => {
  it('contains all 31 cases', () => {
    expect(listStaging31Cases()).toHaveLength(31)
  })

  it('requires full pipeline fields', () => {
    const report: Staging31CaseReport = {
      index: 1,
      input: 'x',
      completedInput: 'x',
      assistantResponse: 'x',
      rulesTree: {},
      rulesFacts: {},
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

    expect(hasUiAstScriptMismatch({
      ...matched,
      scriptOrError: { script: 'return { action: null }' },
    })).toBe(true)
  })

  it('treats grid orderPrograms as UI/AST/script aligned grid actions', () => {
    expect(hasUiAstScriptMismatch({
      rulesTree: [{
        condition: { key: 'grid.range_rebalance' },
        effects: [],
      }],
      uiSummaryOrGraph: {
        graph: {
          blocks: [{ items: [{ kind: 'action', text: '网格挂单' }] }],
        },
      },
      ast: {
        decisionPrograms: [],
        guards: [],
        riskPredicates: [],
        orchestrationPrograms: [],
        orderPrograms: [{
          payload: {
            kind: 'LIMIT_LADDER',
            sidePolicy: 'spot_grid',
          },
        }],
      },
      scriptOrError: { script: 'const ORDER_PROGRAMS = [{\"payload\":{\"kind\":\"LIMIT_LADDER\",\"sidePolicy\":\"spot_grid\"}}] as const' },
    })).toBe(false)
  })

  it('treats grid.range_rebalance effects as executable grid actions', () => {
    expect(hasUiAstScriptMismatch({
      rulesTree: [{
        condition: { key: 'execution.on_start' },
        effects: [{ key: 'grid.range_rebalance' }],
      }],
      uiSummaryOrGraph: {
        graph: {
          blocks: [{ items: [{ kind: 'action', text: '网格区间再平衡' }] }],
        },
      },
      ast: {
        decisionPrograms: [
          { actions: [{ kind: 'OPEN_LONG' }] },
          { actions: [{ kind: 'OPEN_SHORT' }] },
          { actions: [{ kind: 'CLOSE_LONG' }] },
          { actions: [{ kind: 'CLOSE_SHORT' }] },
        ],
        guards: [],
      },
      scriptOrError: {
        script: 'const DECISION_PROGRAMS = [{\"actions\":[{\"kind\":\"OPEN_LONG\"}]},{\"actions\":[{\"kind\":\"OPEN_SHORT\"}]},{\"actions\":[{\"kind\":\"CLOSE_LONG\"}]},{\"actions\":[{\"kind\":\"CLOSE_SHORT\"}]}] as const',
      },
    })).toBe(false)
  })

  it('treats typed effects.risks as close-side semantics', () => {
    expect(hasUiAstScriptMismatch({
      rulesTree: [{
        sideScope: 'long',
        condition: { key: 'price.breakout_up' },
        effects: {
          actions: [{ key: 'action.open_long' }],
          risks: [{ key: 'risk.stop_loss_pct' }],
        },
      }],
      uiSummaryOrGraph: {
        graph: {
          blocks: [{
            items: [
              { kind: 'action', text: '开多' },
              { kind: 'action', text: '止损：价格相对入场均价下跌5% 强制平仓' },
            ],
          }],
        },
      },
      ast: {
        decisionPrograms: [{ actions: [{ kind: 'OPEN_LONG' }] }],
        guards: [{ payload: { appliesTo: 'long', onBreach: 'FORCE_EXIT' } }],
      },
      scriptOrError: {
        script: [
          'const DECISION_PROGRAMS = [{"actions":[{"kind":"OPEN_LONG"}]}] as const',
          'const GUARD_PROGRAMS = [{"payload":{"appliesTo":"long","onBreach":"FORCE_EXIT"}}] as const',
        ].join('\n'),
      },
    })).toBe(false)
  })

  it('does not infer long add action from 最多 in short-side UI text', () => {
    expect(hasUiAstScriptMismatch({
      rulesTree: [{
        sideScope: 'short',
        condition: { key: 'price.percent_change' },
        effects: [{ key: 'action.add_position' }],
      }],
      uiSummaryOrGraph: {
        graph: {
          blocks: [{ items: [{ kind: 'action', text: '加仓：加空，最多 3 次' }] }],
        },
      },
      ast: {
        decisionPrograms: [{ actions: [{ kind: 'ADD_SHORT' }] }],
        guards: [],
      },
      scriptOrError: { script: 'const DECISION_PROGRAMS = [{"actions":[{"kind":"ADD_SHORT"}]}] as const' },
    })).toBe(false)
  })

  it('fails the hard gate unless all 31 real cases pass cleanly', () => {
    const clean = {
      total: 31,
      pass: 31,
      needsClarification: 0,
      unsupported: 0,
      fail: 0,
      emptyRulesWithClear: 0,
      supportedActionReportedUnsupported: 0,
      clarificationClearsRulesTree: 0,
      uiScriptMismatch: 0,
      strategyScriptMismatch: 0,
      dispatcherFallbackUsed: 0,
      unsupportedWithGeneratedScript: 0,
    }

    expect(isStaging31HardGatePassing(clean)).toBe(true)
    expect(isStaging31HardGatePassing({ ...clean, pass: 30, fail: 1 })).toBe(false)
    expect(isStaging31HardGatePassing({ ...clean, uiScriptMismatch: 1 })).toBe(false)
    expect(isStaging31HardGatePassing({ ...clean, strategyScriptMismatch: 1 })).toBe(false)
    expect(isStaging31HardGatePassing({ ...clean, dispatcherFallbackUsed: 1 })).toBe(false)
  })

  it('uses an explicit fallback exit answer for strategies without exit text', () => {
    const answer = inferClarificationAnswer('BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层', {
      key: 'rulesTree.exit',
      field: 'exitRules',
      reason: 'missing_exit_rules',
      question: '请补充出场条件，例如什么价格或指标条件触发平仓。',
      blocking: true,
      status: 'pending',
    })

    expect(answer).toBe('价格相对入场均价下跌 5% 时平仓。')
  })
})
