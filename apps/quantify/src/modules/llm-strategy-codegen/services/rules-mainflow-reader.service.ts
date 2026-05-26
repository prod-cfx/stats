import { Injectable } from '@nestjs/common'
import type { AtomExpr, AtomExprAtom, RuleEffectsByRole, SemanticRule } from '../types/atom-expr'
import { isRuleEffectsByRole } from '../types/atom-expr'
import type {
  SemanticAtomContract,
  SemanticNodeStatus,
  SemanticOrchestrationContract,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
} from '../types/semantic-state'

export type MainflowLeafRole = 'condition' | 'action' | 'risk' | 'position' | 'orchestration' | 'program'

export interface RulesMainflowLeaf {
  ruleId: string
  ruleIndex: number
  phase: SemanticRule['phase']
  sideScope: SemanticRule['sideScope']
  role: MainflowLeafRole
  key: string
  params: Record<string, unknown>
  path: string
  evidenceText: string | null
}

export interface RulesMainflowView {
  rules: readonly SemanticRule[]
  leaves: readonly RulesMainflowLeaf[]
  byRole: Record<MainflowLeafRole, readonly RulesMainflowLeaf[]>
}

export interface RulesMainflowAtomFact extends RulesMainflowLeaf {
  id: string
  status: SemanticNodeStatus
  source: SemanticSource
  openSlots: readonly SemanticSlotState[]
  contracts?: readonly (SemanticAtomContract | SemanticOrchestrationContract)[]
  _provenance?: {
    ruleId: string
    conditionPath: string
  }
}

type RulesMainflowFactState = Pick<SemanticState, 'rules'>

export type RulesMainflowReadResult =
  | { ok: true, view: RulesMainflowView, leaves: readonly RulesMainflowLeaf[] }
  | {
    ok: false
    reason: 'rules_missing_or_empty' | 'legacy_effects_array' | 'invalid_expr'
    diagnostics: readonly string[]
  }

const EFFECT_ROLE_MAP = {
  actions: 'action',
  risks: 'risk',
  positions: 'position',
  orchestration: 'orchestration',
  programs: 'program',
} as const satisfies Record<keyof RuleEffectsByRole, MainflowLeafRole>

const EFFECT_ROLE_KEYS = [
  'actions',
  'risks',
  'positions',
  'orchestration',
  'programs',
] as const satisfies ReadonlyArray<keyof RuleEffectsByRole>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

@Injectable()
export class RulesMainflowReaderService {
  readFacts(state: RulesMainflowFactState): readonly RulesMainflowAtomFact[] {
    const rules = state.rules
    if (rules?.length) {
      const read = this.readMainflowRules(rules)
      if (read.ok) {
        return read.leaves.map(leaf => this.factFromLeaf(leaf))
      }
    }
    return []
  }

  readFactsByRole(state: RulesMainflowFactState, role: MainflowLeafRole): readonly RulesMainflowAtomFact[] {
    return this.readFacts(state).filter(fact => fact.role === role)
  }

  readMainflowRules(rules: readonly SemanticRule[] | null | undefined): RulesMainflowReadResult {
    if (!rules?.length) {
      return {
        ok: false,
        reason: 'rules_missing_or_empty',
        diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
      }
    }

    const leaves: RulesMainflowLeaf[] = []
    const diagnostics: string[] = []
    let hasLegacyEffectsArray = false

    rules.forEach((rule, ruleIndex) => {
      this.collectExprLeaves({
        expr: rule.condition,
        rule,
        ruleIndex,
        role: 'condition',
        path: `rules[${ruleIndex}].condition`,
        leaves,
        diagnostics,
      })

      if (Array.isArray(rule.effects)) {
        hasLegacyEffectsArray = true
        diagnostics.push(`rules[${ruleIndex}].effects must be typed RuleEffects`)
        return
      }

      if (!isRuleEffectsByRole(rule.effects)) {
        diagnostics.push(`rules[${ruleIndex}].effects must be typed RuleEffects`)
        return
      }

      for (const effectRoleKey of EFFECT_ROLE_KEYS) {
        const effects = rule.effects[effectRoleKey]
        if (!Array.isArray(effects)) {
          diagnostics.push(`rules[${ruleIndex}].effects.${effectRoleKey} must be an array`)
          continue
        }

        effects.forEach((effect, effectIndex) => {
          this.collectExprLeaves({
            expr: effect,
            rule,
            ruleIndex,
            role: EFFECT_ROLE_MAP[effectRoleKey],
            path: `rules[${ruleIndex}].effects.${effectRoleKey}[${effectIndex}]`,
            leaves,
            diagnostics,
          })
        })
      }
    })

    if (hasLegacyEffectsArray) {
      return {
        ok: false,
        reason: 'legacy_effects_array',
        diagnostics,
      }
    }

    if (diagnostics.length > 0) {
      return {
        ok: false,
        reason: 'invalid_expr',
        diagnostics,
      }
    }

    const byRole = this.groupByRole(leaves)

    return {
      ok: true,
      view: {
        rules,
        leaves,
        byRole,
      },
      leaves,
    }
  }

  private collectExprLeaves(input: {
    expr: unknown
    rule: SemanticRule
    ruleIndex: number
    role: MainflowLeafRole
    path: string
    leaves: RulesMainflowLeaf[]
    diagnostics: string[]
  }): void {
    const { expr, rule, ruleIndex, role, path, leaves, diagnostics } = input

    if (!isRecord(expr)) {
      diagnostics.push(`${path} must be an AtomExpr object`)
      return
    }

    switch (expr.kind) {
      case 'atom':
        if (typeof expr.key !== 'string') {
          diagnostics.push(`${path}.key must be a string`)
          return
        }
        if (expr.params != null && !isRecord(expr.params)) {
          diagnostics.push(`${path}.params must be an object`)
          return
        }
        const params: Record<string, unknown> = isRecord(expr.params) ? expr.params : {}
        leaves.push(this.toLeaf({
          kind: 'atom',
          key: expr.key,
          params,
          sideScope: expr.sideScope === 'long' || expr.sideScope === 'short' || expr.sideScope === 'both'
            ? expr.sideScope
            : undefined,
          evidence: isRecord(expr.evidence) && typeof expr.evidence.text === 'string'
            ? { text: expr.evidence.text }
            : undefined,
        }, rule, ruleIndex, role, path))
        return
      case 'and':
      case 'or':
        if (!Array.isArray(expr.children)) {
          diagnostics.push(`${path}.${expr.kind}.children must be an array`)
          return
        }
        expr.children.forEach((child, childIndex) => {
          this.collectExprLeaves({
            expr: child,
            rule,
            ruleIndex,
            role,
            path: `${path}.${expr.kind}.children[${childIndex}]`,
            leaves,
            diagnostics,
          })
        })
        return
      case 'not':
        this.collectExprLeaves({
          expr: expr.child,
          rule,
          ruleIndex,
          role,
          path: `${path}.not.child`,
          leaves,
          diagnostics,
        })
        return
      case 'sequence':
        if (!Array.isArray(expr.steps)) {
          diagnostics.push(`${path}.sequence.steps must be an array`)
          return
        }
        expr.steps.forEach((step, stepIndex) => {
          this.collectExprLeaves({
            expr: step,
            rule,
            ruleIndex,
            role,
            path: `${path}.sequence.steps[${stepIndex}]`,
            leaves,
            diagnostics,
          })
        })
        return
      default:
        diagnostics.push(`${path}.kind must be one of atom, and, or, not, sequence`)
    }
  }

  private toLeaf(
    atom: AtomExprAtom,
    rule: SemanticRule,
    ruleIndex: number,
    role: MainflowLeafRole,
    path: string,
  ): RulesMainflowLeaf {
    return {
      ruleId: rule.id,
      ruleIndex,
      phase: rule.phase,
      sideScope: atom.sideScope ?? rule.sideScope,
      role,
      key: atom.key,
      params: atom.params ?? {},
      path,
      evidenceText: atom.evidence?.text ?? rule.evidence?.text ?? null,
    }
  }

  private groupByRole(leaves: readonly RulesMainflowLeaf[]): Record<MainflowLeafRole, readonly RulesMainflowLeaf[]> {
    const byRole: Record<MainflowLeafRole, RulesMainflowLeaf[]> = {
      condition: [],
      action: [],
      risk: [],
      position: [],
      orchestration: [],
      program: [],
    }

    for (const leaf of leaves) {
      byRole[leaf.role].push(leaf)
    }

    return byRole
  }

  private factFromLeaf(leaf: RulesMainflowLeaf): RulesMainflowAtomFact {
    return {
      ...leaf,
      id: leaf.role === 'condition' ? leaf.ruleId : `${leaf.ruleId}:${this.stablePathId(leaf.path)}`,
      status: 'locked',
      source: 'derived',
      openSlots: [],
      _provenance: {
        ruleId: leaf.ruleId,
        conditionPath: leaf.path.replace(/^rules\[\d+\]\./u, ''),
      },
    }
  }

  private stablePathId(path: string): string {
    return path.replace(/[^a-zA-Z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  }
}
