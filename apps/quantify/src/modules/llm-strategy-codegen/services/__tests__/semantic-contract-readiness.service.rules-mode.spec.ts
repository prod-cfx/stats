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
import type { SemanticState } from '../../types/semantic-state'
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

  it('rules 非空但全无 effects → 报 missing_entry/exit；risk 不作为硬阻断', () => {
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
    expect(r.missing).not.toContain('missing_risk')
  })

  it('entry-only executable rules still require explicit exit semantics', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'entry-only',
        phase: 'entry',
        condition: atom('external.signal', { provider: 'webhook', signalId: 'whale_buy' }),
        effects: [atom('action.open_long')],
      }),
    ]

    const r = svc.evaluateRulesReadiness(rules)

    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(false)
    expect(r.missing).toContain('missing_exit')
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

  it('risk effect that fulfills exit counts as rules-tree exit', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r-risk-exit',
        phase: 'entry',
        sideScope: 'long',
        condition: sequence(
          atom('price.breakout_up', { period: 24, reference: 'channel_high' }),
          atom('price.previous_extrema_retest', { memoryKey: 'auto', retestKind: 'not_break' }),
        ),
        effects: [
          atom('action.open_long'),
          atom('risk.remembered_level_stop', { levelKey: 'previous_extrema' }),
        ],
      }),
    ]

    const r = svc.evaluateRulesReadiness(rules)

    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.hasRisk).toBe(true)
    expect(r.missing).not.toContain('missing_exit')
  })

  it('program effect that fulfills entry counts as rules-tree entry', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r-program-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: andExpr(
          atom('price.range_position_gte', { lookbackBars: 48, thresholdPct: 0.3 }),
          atom('price.range_position_lte', { lookbackBars: 48, thresholdPct: 0.7 }),
        ),
        effects: [
          atom('program.adaptive_volatility_grid', {
            atrPeriod: 14,
            atrMultiplier: 1.5,
            rangeMultiplier: 3,
            levelCount: 6,
          }),
        ],
      }),
      rule({
        id: 'r-exit',
        phase: 'exit',
        sideScope: 'long',
        condition: atom('price.range_position_gte', { lookbackBars: 48, thresholdPct: 0.7 }),
        effects: [atom('action.close_long')],
      }),
    ]

    const r = svc.evaluateRulesReadiness(rules)

    expect(r.hasEntry).toBe(true)
    expect(r.hasExit).toBe(true)
    expect(r.missing).toEqual([])
  })
})

describe('semanticContractReadinessService.normalize DCA exit contract in rules tree', () => {
  const svc = new SemanticContractReadinessService()

  it('treats an explicit sibling exit rule as satisfying position.dca_schedule dca_exit_rule', () => {
    const result = svc.normalize(stateWithRules([
      rule({
        id: 'entry-dca-daily',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('strategy.time_window', { window: 'daily' }),
        effects: [
          atom('action.open_long'),
          atom('position.dca_schedule', {
          triggerMode: 'time_interval',
          timeIntervalBars: 1,
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
          }),
        ],
      }),
      rule({
        id: 'exit-drawdown-stop',
        phase: 'exit',
        sideScope: 'long',
        condition: atom('price.percent_change', {
          direction: 'down',
          thresholdPct: 5,
          basis: 'entry_avg_price',
        }),
        effects: [atom('action.close_long')],
      }),
      rule({
        id: 'entry-drawdown-add',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('price.percent_change', {
          direction: 'down',
          valuePct: 5,
          basis: 'entry_avg_price',
        }),
        effects: [
          atom('action.add_position', {
            addMode: 'drawdown_pct',
            drawdownThreshold: 5,
            sizing: { kind: 'quote', value: 200, asset: 'USDT' },
          }),
        ],
      }),
    ]))

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'guard',
        verb: 'define',
        object: 'dca_exit_rule',
      }),
    ]))
  })

  it('still requires a dca_exit_rule when DCA has no exit semantics', () => {
    const result = svc.normalize(stateWithRules([
      rule({
        id: 'entry-dca-daily',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('strategy.time_window', { window: 'daily' }),
        effects: [
          atom('action.open_long'),
          atom('position.dca_schedule', {
          triggerMode: 'time_interval',
          timeIntervalBars: 1,
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
          }),
        ],
      }),
    ]))

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'guard',
        verb: 'define',
        object: 'dca_exit_rule',
      }),
    ]))
  })
})

function stateWithRules(rules: SemanticRule[]): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: {
      mode: 'constraint_only',
      value: 0,
      positionMode: 'long_only',
      status: 'locked',
      source: 'derived',
      openSlots: [],
      constraints: [{
        id: 'entry-dca-daily-leaf-position.dca_schedule',
        key: 'position.dca_schedule',
        params: {
          triggerMode: 'time_interval',
          timeIntervalBars: 1,
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
        },
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'contract-seed-position-constraint-1-position-dca-schedule',
          kind: 'position',
          capabilities: [
            { domain: 'runtime', verb: 'schedule', object: 'dca_orders', shape: {} },
            { domain: 'capital', verb: 'allocate', object: 'per_order_budget', shape: { kind: 'quote', value: 100, asset: 'USDT' } },
          ],
          requires: [{ domain: 'guard', verb: 'define', object: 'dca_exit_rule' }],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    },
    contextSlots: {
      exchange: lockedContextSlot('exchange', 'okx'),
      symbol: lockedContextSlot('symbol', 'ETHUSDT'),
      marketType: lockedContextSlot('marketType', 'spot'),
      timeframe: lockedContextSlot('timeframe', '1d'),
    },
    normalizationNotes: [],
    rules,
    updatedAt: '2026-05-20T00:00:00.000Z',
  }
}

function lockedContextSlot(slotKey: 'exchange' | 'symbol' | 'marketType' | 'timeframe', value: string) {
  return {
    slotKey,
    fieldPath: `contextSlots.${slotKey}`,
    value,
    status: 'locked' as const,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}
