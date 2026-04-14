import type { SemanticStrategyGraph } from '../../types/semantic-strategy-graph'
import { SemanticGraphValidatorService } from '../semantic-graph-validator.service'

describe('semanticGraphValidatorService', () => {
  const validator = new SemanticGraphValidatorService()

  it('returns incomplete when graph is empty', () => {
    const result = validator.validate({
      graph: null,
      unsupportedFeatures: [],
      diagnostics: [],
    })

    expect(result.ok).toBe(false)
    expect(result.errors.map(error => error.code)).toContain('codegen.semantic_graph_incomplete')
  })

  it('returns invalid reference when logical group points to unknown node', () => {
    const graph = {
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
      nodes: [
        {
          id: 'n1',
          phase: 'entry',
          kind: 'logical_group',
          params: { join: 'AND', members: ['missing-node'] },
        },
      ],
      actions: [{ id: 'a1', kind: 'OPEN_LONG', sizePct: 10 }],
      risk: [],
    } as unknown as SemanticStrategyGraph

    const result = validator.validate({
      graph,
      unsupportedFeatures: [],
      diagnostics: [],
    })

    expect(result.ok).toBe(false)
    expect(result.errors.map(error => error.code)).toContain('codegen.semantic_graph_invalid_reference')
  })

  it('returns unsupported feature when builder reports unsupported semantics', () => {
    const result = validator.validate({
      graph: null,
      unsupportedFeatures: ['短均线金叉'],
      diagnostics: [],
    })

    expect(result.ok).toBe(false)
    expect(result.errors.map(error => error.code)).toContain('codegen.semantic_graph_unsupported_feature')
  })

  it('returns incomplete when diagnostics contain missing grid params', () => {
    const result = validator.validate({
      graph: null,
      unsupportedFeatures: [],
      diagnostics: ['grid_params_missing'],
    })

    expect(result.ok).toBe(false)
    expect(result.errors.map(error => error.code)).toContain('codegen.semantic_graph_incomplete')
  })

})
