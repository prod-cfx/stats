import { MODULE_METADATA } from '@nestjs/common/constants'
import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import { LlmStrategyCodegenModule } from '../../llm-strategy-codegen.module'
import { RulesMainflowReaderService } from '../rules-mainflow-reader.service'

const atom = (key: string, params: Record<string, unknown> = {}): AtomExpr => ({ kind: 'atom', key, params })

describe('RulesMainflowReaderService', () => {
  const reader = new RulesMainflowReaderService()

  it('extracts condition and typed effect leaves with source paths', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'and', children: [atom('indicator.ema_above'), atom('volume.threshold')] },
      effects: {
        actions: [atom('action.open_long')],
        risks: [atom('risk.stop_loss_pct', { pct: 5 })],
        positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
        orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
        programs: [],
      },
      evidence: { text: 'ema above and volume' },
    }]

    const view = reader.readMainflowRules(rules)

    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.leaves.map(leaf => [leaf.role, leaf.key, leaf.path])).toEqual([
      ['condition', 'indicator.ema_above', 'rules[0].condition.and.children[0]'],
      ['condition', 'volume.threshold', 'rules[0].condition.and.children[1]'],
      ['action', 'action.open_long', 'rules[0].effects.actions[0]'],
      ['risk', 'risk.stop_loss_pct', 'rules[0].effects.risks[0]'],
      ['position', 'position.sizing', 'rules[0].effects.positions[0]'],
      ['orchestration', 'scope.timeframe', 'rules[0].effects.orchestration[0]'],
    ])
  })

  it('rejects empty rules for production mainflow', () => {
    expect(reader.readMainflowRules([])).toEqual({
      ok: false,
      reason: 'rules_missing_or_empty',
      diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
    })
  })

  it('rejects null and undefined rules for production mainflow', () => {
    expect(reader.readMainflowRules(null)).toEqual({
      ok: false,
      reason: 'rules_missing_or_empty',
      diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
    })
    expect(reader.readMainflowRules(undefined)).toEqual({
      ok: false,
      reason: 'rules_missing_or_empty',
      diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
    })
  })

  it('rejects legacy array effects for production mainflow', () => {
    const rules: SemanticRule[] = [{
      id: 'legacy',
      phase: 'entry',
      sideScope: 'long',
      condition: atom('price.breakout'),
      effects: [atom('action.open_long')],
    }]

    expect(reader.readMainflowRules(rules)).toMatchObject({
      ok: false,
      reason: 'legacy_effects_array',
    })
  })

  it('rejects missing effect role arrays without throwing', () => {
    const rules = [{
      id: 'missing-role',
      phase: 'entry',
      sideScope: 'long',
      condition: atom('price.breakout'),
      effects: {
        actions: [],
        risks: [],
        positions: [],
        orchestration: [],
      },
    }] as unknown as SemanticRule[]

    expect(() => reader.readMainflowRules(rules)).not.toThrow()
    expect(reader.readMainflowRules(rules)).toEqual({
      ok: false,
      reason: 'invalid_expr',
      diagnostics: ['rules[0].effects.programs must be an array'],
    })
  })

  it('rejects malformed expressions without throwing', () => {
    const rules = [{
      id: 'malformed',
      phase: 'entry',
      sideScope: 'long',
      condition: null,
      effects: {
        actions: [{ kind: 'atom', key: 123, params: {} }],
        risks: [{ kind: 'and' }],
        positions: [{ kind: 'sequence' }],
        orchestration: [{ kind: 'not' }],
        programs: [],
      },
    }] as unknown as SemanticRule[]

    expect(() => reader.readMainflowRules(rules)).not.toThrow()
    expect(reader.readMainflowRules(rules)).toEqual({
      ok: false,
      reason: 'invalid_expr',
      diagnostics: [
        'rules[0].condition must be an AtomExpr object',
        'rules[0].effects.actions[0].key must be a string',
        'rules[0].effects.risks[0].and.children must be an array',
        'rules[0].effects.positions[0].sequence.steps must be an array',
        'rules[0].effects.orchestration[0].not.child must be an AtomExpr object',
      ],
    })
  })

  it('extracts program effects and nested not sequence paths', () => {
    const rules: SemanticRule[] = [{
      id: 'nested',
      phase: 'program',
      sideScope: 'both',
      condition: {
        kind: 'not',
        child: {
          kind: 'sequence',
          steps: [atom('price.reject'), atom('volume.fade')],
        },
      },
      effects: {
        actions: [],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [atom('program.cooldown')],
      },
    }]

    const view = reader.readMainflowRules(rules)

    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.leaves.map(leaf => [leaf.role, leaf.key, leaf.path])).toEqual([
      ['condition', 'price.reject', 'rules[0].condition.not.child.sequence.steps[0]'],
      ['condition', 'volume.fade', 'rules[0].condition.not.child.sequence.steps[1]'],
      ['program', 'program.cooldown', 'rules[0].effects.programs[0]'],
    ])
  })

  it('registers reader as module provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule) as unknown[]

    expect(providers).toContain(RulesMainflowReaderService)
  })
})
