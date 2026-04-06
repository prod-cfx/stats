import type { HashString } from '../types/canonical-strategy-ir'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'

function stableJsonStringify(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

function hashCanonicalJson(value: unknown): HashString {
  const digest = createHash('sha256').update(stableJsonStringify(value)).digest('hex')
  return `sha256:${digest}`
}

@Injectable()
export class GraphSemanticProjectionService {
  toSemanticProjection(graph: StrategyLogicGraphSnapshot): Record<string, unknown> {
    return {
      version: graph.version,
      status: graph.status,
      trigger: graph.trigger.map(item => ({
        phase: item.phase,
        operator: item.operator,
        join: item.join,
      })),
      actions: graph.actions.map(item => ({
        action: item.action,
        target: item.target,
        amount: item.amount,
      })),
      risk: [...graph.risk],
      meta: {
        ...graph.meta,
        executionTags: [...graph.meta.executionTags],
      },
    }
  }

  buildSource(graph: StrategyLogicGraphSnapshot): {
    graphVersion: number
    graphDigest: HashString
    specHash: HashString
  } {
    const semantic = this.toSemanticProjection(graph)
    const graphDigest = hashCanonicalJson(semantic)
    return {
      graphVersion: graph.version,
      graphDigest,
      specHash: graphDigest,
    }
  }
}

export const __test__ = {
  hashCanonicalJson,
  stableJsonStringify,
}
