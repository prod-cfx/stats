import type { CanonicalConditionNode, CanonicalRuleV2, CanonicalStrategySpecV2 } from '../types/canonical-strategy-spec-v2'
import { Injectable } from '@nestjs/common'

export interface CanonicalSpecV2ValidationReport {
  status: 'VALID' | 'INVALID'
  errors: string[]
}

@Injectable()
export class CanonicalSpecV2ValidatorService {
  validate(spec: CanonicalStrategySpecV2): CanonicalSpecV2ValidationReport {
    const errors: string[] = []

    for (const rule of spec.rules) {
      const actionTypes = rule.actions.map(action => action.type)
      if (
        rule.phase === 'entry'
        && actionTypes.includes('OPEN_LONG')
        && actionTypes.includes('OPEN_SHORT')
      ) {
        errors.push('entry_rule_mutually_exclusive_open_actions')
      }

      if (this.requiresSideScope(rule) && !this.hasMeaningfulRiskSideScope(rule.sideScope)) {
        errors.push('rule_requires_side_scope')
      }
    }

    return {
      status: errors.length > 0 ? 'INVALID' : 'VALID',
      errors,
    }
  }

  private requiresSideScope(rule: CanonicalRuleV2): boolean {
    if (rule.phase !== 'risk') return false

    const sideSensitiveActionTypes = new Set(['FORCE_EXIT', 'REDUCE_POSITION', 'CLOSE_LONG', 'CLOSE_SHORT'])
    if (rule.actions.some(action => sideSensitiveActionTypes.has(action.type))) {
      return true
    }

    return this.containsSideSensitiveCondition(rule.condition)
  }

  private hasMeaningfulRiskSideScope(sideScope: CanonicalRuleV2['sideScope']): boolean {
    return sideScope === 'long' || sideScope === 'short' || sideScope === 'both'
  }

  private containsSideSensitiveCondition(condition: CanonicalConditionNode): boolean {
    if (condition.kind === 'atom') {
      return condition.semanticScope === 'position'
    }
    if (condition.kind === 'expression') {
      return condition.left.kind === 'position' || condition.right.kind === 'position'
    }

    return condition.children.some(child => this.containsSideSensitiveCondition(child))
  }
}
