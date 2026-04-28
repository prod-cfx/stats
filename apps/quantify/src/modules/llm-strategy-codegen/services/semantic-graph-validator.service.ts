import type { SemanticGraphBuildResult } from './semantic-graph-builder.service'
import { Injectable } from '@nestjs/common'
import { semanticStrategyGraphV1Schema } from '../types/semantic-strategy-graph.zod'

export interface SemanticGraphValidationError {
  code:
    | 'codegen.semantic_graph_incomplete'
    | 'codegen.semantic_graph_invalid_reference'
    | 'codegen.semantic_graph_unsupported_feature'
  message: string
}

export interface SemanticGraphValidationResult {
  ok: boolean
  errors: SemanticGraphValidationError[]
}

@Injectable()
export class SemanticGraphValidatorService {
  validate(input: SemanticGraphBuildResult): SemanticGraphValidationResult {
    const errors: SemanticGraphValidationError[] = []

    if (input.unsupportedFeatures.length > 0) {
      errors.push({
        code: 'codegen.semantic_graph_unsupported_feature',
        message: `unsupported: ${input.unsupportedFeatures.join('、')}`,
      })
    }

    if (!input.graph) {
      errors.push({
        code: 'codegen.semantic_graph_incomplete',
        message: 'semantic graph is empty',
      })
      if (input.diagnostics.length > 0) {
        errors.push({
          code: 'codegen.semantic_graph_incomplete',
          message: `unmapped logic fields: ${input.diagnostics.join(',')}`,
        })
      }
      return {
        ok: false,
        errors: this.dedupeErrors(errors),
      }
    }

    const parsed = semanticStrategyGraphV1Schema.safeParse(input.graph)
    if (!parsed.success) {
      const hasInvalidReference = parsed.error.issues.some(issue =>
        issue.message.includes('logical group references unknown node'),
      )
      errors.push({
        code: hasInvalidReference ? 'codegen.semantic_graph_invalid_reference' : 'codegen.semantic_graph_incomplete',
        message: parsed.error.issues[0]?.message ?? 'semantic graph parse failed',
      })
    } else {
      const nodeIds = new Set(parsed.data.nodes.map(node => node.id))
      const hasUnknownReference = parsed.data.nodes.some((node) => {
        if (node.kind !== 'logical_group') return false
        return node.params.members.some(member => !nodeIds.has(member))
      })
      if (hasUnknownReference) {
        errors.push({
          code: 'codegen.semantic_graph_invalid_reference',
          message: 'logical group references unknown node',
        })
      }
      if (parsed.data.nodes.length === 0 || parsed.data.actions.length === 0) {
        errors.push({
          code: 'codegen.semantic_graph_incomplete',
          message: 'semantic graph requires at least one node and one action',
        })
      }
    }

    if (input.diagnostics.length > 0) {
      errors.push({
        code: 'codegen.semantic_graph_incomplete',
        message: `unmapped logic fields: ${input.diagnostics.join(',')}`,
      })
    }

    return {
      ok: errors.length === 0,
      errors: this.dedupeErrors(errors),
    }
  }

  private dedupeErrors(errors: SemanticGraphValidationError[]): SemanticGraphValidationError[] {
    const seen = new Set<string>()
    const deduped: SemanticGraphValidationError[] = []
    for (const error of errors) {
      const key = `${error.code}:${error.message}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(error)
    }
    return deduped
  }
}
