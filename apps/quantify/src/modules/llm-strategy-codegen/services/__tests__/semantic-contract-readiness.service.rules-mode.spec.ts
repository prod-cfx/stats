/**
 * Issue #1395 — semantic-contract-readiness 的 rules-tree 优先判定。
 *
 * 覆盖：
 *  - S1 grid: 单 rule + grid.range_rebalance condition → 闭环
 *  - S2 sequence root + action.open_long effects → entry ok
 *  - S4 AND(predicate1, predicate2) entry + action.open_long effect → entry ok
 *  - rules 空：missing rules_empty（调用方 fallback 旧扁平桶）
 *  - rules 全空 effects：missing_entry / missing_exit / missing_risk
 *  - grid 越界 breakoutAction=stop：exit 强化
 */
import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'

function atom(key: string, params: Record<string, unknown> = {}): AtomExpr {
  return { kind: 'atom', key, params }
}

function andExpr(...children: AtomExpr[]): AtomExpr {
  return { kind: 'and', children }
}

function sequence(...steps: AtomExpr[]): AtomExpr {
  return { kind: 'sequence', steps }
}

function rule(partial: Partial<SemanticRule> & { id: string; condition: AtomExpr }): SemanticRule {
  return {
    id: partial.id,
    phase: partial.phase ?? 'entry',
    sideScope: partial.sideScope ?? 'both',
    condition: partial.condition,
    effects: partial.effects ?? [],
  }
}

describe('semanticContractReadinessService.evaluateRulesReadiness', () => {
  const svc = new SemanticContractReadinessService()

  it('s1: grid.range_rebalance 单 rule 即视为 entry + exit + risk + position 完整', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('grid.range_rebalance', {
          rangeLower: 30000,
          rangeUpper: 40000,
          stepPct: 1,
          perGridSizing: 20,
        }),
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.hasRisk).toBe(true)
    expect(r.hasPosition).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('s2: sequence(entry) + action.open_long effect → entry 完整', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: sequence(
          atom('price.touch_lower_band'),
          atom('volume.threshold', { multiplier: 1.5 }),
        ),
        effects: [atom('action.open_long')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('price.cross_above_ma', { period: 20 }),
        effects: [atom('action.close_long')],
      }),
      rule({
        id: 'r3',
        phase: 'exit',
        condition: atom('risk.stop_loss_pct', { pct: 5 }),
        effects: [atom('risk.stop_loss_pct', { pct: 5 })],
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.hasRisk).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('s4: AND(bollinger, volume) entry + action.open_long → 不应报 missing_entry', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: andExpr(
          atom('bollinger.touch_lower'),
          atom('volume.threshold', { multiplier: 2 }),
        ),
        effects: [atom('action.open_long')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('action.close_long'),
        effects: [atom('action.close_long'), atom('risk.take_profit_pct', { pct: 5 })],
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.missing).not.toContain('missing_entry')
    expect(r.missing).not.toContain('missing_exit')
    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.hasRisk).toBe(true)
  })

  it('rules 为空 → 返回 rules_empty，调用方据此走旧扁平桶 fallback', () => {
    const r = svc.evaluateRulesReadiness([])
    expect(r.missing).toEqual(['rules_empty'])
    expect(r.hasEntry).toBe(false)
    expect(r.hasExit).toBe(false)
    expect(r.hasRisk).toBe(false)
  })

  it('rules undefined → 同样返回 rules_empty', () => {
    const r = svc.evaluateRulesReadiness(undefined)
    expect(r.missing).toEqual(['rules_empty'])
  })

  it('rules 非空但全无 effects → 报 missing_entry/exit/risk', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('price.cross_above_ma'),
        effects: [],
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.missing).toContain('missing_entry')
    expect(r.missing).toContain('missing_exit')
    expect(r.missing).toContain('missing_risk')
  })

  it('grid.range_rebalance with breakoutAction=stop 强化 exit', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('grid.range_rebalance', {
          rangeLower: 100,
          rangeUpper: 200,
          breakoutAction: 'stop',
        }),
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.hasExit).toBe(true)
    expect(r.hasEntry).toBe(true)
  })

  it('phase=gate + action.open_short effect → entry 完整（gate 视同入场）', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'gate',
        condition: atom('regime.bull'),
        effects: [atom('action.open_short')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('regime.bear'),
        effects: [atom('action.close_short'), atom('risk.atr_stop')],
      }),
    ]
    const r = svc.evaluateRulesReadiness(rules)
    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.hasRisk).toBe(true)
  })
})
