/**
 * Issue #1633 Stage 3 — readiness 以 rules tree 为权威。
 *
 * 覆盖（验收标准 #19/#21/#24）：
 *  - rules 非空但旧 bucket 强制传入 → normalize() 不读不回写旧 bucket
 *  - rules 含 AND(a,b) → rules readiness 仍按复合条件闭环
 *  - rules=[] + 旧 bucket 非空 → fail-closed，不退回 legacy bucket
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

function rule(partial: Partial<SemanticRule> & { id: string; condition: AtomExpr }): SemanticRule {
  return {
    id: partial.id,
    phase: partial.phase ?? 'entry',
    sideScope: partial.sideScope ?? 'both',
    condition: partial.condition,
    effects: partial.effects ?? [],
  }
}

function baseState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  }
}

function lockedExecutableContext(): SemanticState['contextSlots'] {
  return {
    exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
    symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
    marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
    timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
  }
}

function hasLegacyBucket(state: SemanticState, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(state, key)
}

describe('#1633 Stage 3 — readiness rules-only source-of-truth', () => {
  const svc = new SemanticContractReadinessService()

  it('rules 非空 + 旧 bucket 强制传入：normalize() 不读不回写旧 bucket', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('bollinger.touch_lower'),
        effects: [atom('action.open_long')],
      }),
      rule({
        id: 'r2',
        phase: 'exit',
        condition: atom('price.cross_above_ma', { period: 20 }),
        effects: [atom('action.close_long'), atom('risk.stop_loss_pct', { pct: 5 })],
      }),
    ]
    const state = baseState({
      rules,
      contextSlots: lockedExecutableContext(),
      trigger: [],
      action: [],
      risk: [],
    } as Partial<SemanticState>)

    const result = svc.normalize(state)

    expect(result.ready).toBe(true)
    expect(hasLegacyBucket(result.state, 'trigger')).toBe(false)
    expect(hasLegacyBucket(result.state, 'action')).toBe(false)
    expect(hasLegacyBucket(result.state, 'risk')).toBe(false)
  })

  it('rules AND(a, b) 多叶子：rules readiness 按复合条件闭环，不暴露 trigger bucket', () => {
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
        condition: atom('price.cross_above_ma'),
        effects: [atom('action.close_long'), atom('risk.stop_loss_pct', { pct: 3 })],
      }),
    ]
    const state = baseState({
      rules,
      contextSlots: lockedExecutableContext(),
      trigger: [
        // 假装上游错误地把 AND 拆成两条独立 trigger（没 combinationContract）
        // 验证：normalize 后这套伪造 flat 被 reproject 替换
        { id: 'fake-a', key: 'bollinger.touch_lower', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [], contracts: [] } as never,
        { id: 'fake-b', key: 'volume.threshold', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [], contracts: [] } as never,
      ],
    })

    const result = svc.normalize(state)

    expect(result.ready).toBe(true)
    expect(hasLegacyBucket(result.state, 'trigger')).toBe(false)
  })

  it('rules=[] + 旧 bucket 非空：fail-closed，不回退 legacy bucket', () => {
    const state = baseState({
      trigger: [{
        id: 'legacy-trigger',
        key: 'bollinger.touch_lower',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'tc-1',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }] as never,
      action: [{
        id: 'legacy-action',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'ac-1',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }] as never,
    })

    const result = svc.normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ errorCode: 'READINESS_RULES_TREE_EMPTY' }),
    ]))
    expect(hasLegacyBucket(result.state, 'trigger')).toBe(false)
    expect(hasLegacyBucket(result.state, 'action')).toBe(false)
  })

  it('rules 非空时即便上游传入旧 bucket 与 rules 不一致也丢弃旧 bucket', () => {
    const rules: SemanticRule[] = [
      rule({
        id: 'r1',
        phase: 'entry',
        condition: atom('bollinger.touch_lower'),
        effects: [atom('action.open_long')],
      }),
    ]
    // 上游错误：flat 写了一个 rules 里没有的 trigger（key 错乱）
    const state = baseState({
      rules,
      trigger: [{
        id: 'wrong-key-trigger',
        key: 'price.breakout_up',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
      }] as never,
    })

    const result = svc.normalize(state)

    expect(hasLegacyBucket(result.state, 'trigger')).toBe(false)
  })
})
