import type { CompiledOrchestrationLegScope, CompiledOrchestrationScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import { applyLegScopeRouting, runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import { CURRENT_SEMANTIC_VERSION, getDisplayToken } from '../../nl-gateway'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

/**
 * Phase 5 S11 (#1112): scope.leg substrate 5 段集成 golden corpus
 *
 * Section A: NL pipeline parseLegScope 命中表 6 fixture + 1 negative
 * Section B: Readiness 8 重 fail-closed + 多 leg binding fail-closed
 * Section C: Display 不泄漏内部 key
 * Section D: canonical → IR → AST 全链路 + 1-leg 兜底
 * Section E: runtime fail-closed 路由 5 case + W5 多 program skip 不影响其他 program
 *
 * 验收 ≥3 case 必含：
 *   1) 双腿对冲 supported（D1）
 *   2) 多 leg 节点未绑 fail-closed（B-binding）
 *   3) 单腿默认兜底（E1）
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...overrides,
  }
}

function symbolScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'scope-symbol-1',
    kind: 'scope',
    key: 'scope.symbol',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    symbolScopeKind: 'symbol',
    symbols: ['BTCUSDT'],
    primarySymbol: 'BTCUSDT',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function legScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'scope-leg-1',
    kind: 'scope',
    key: 'scope.leg',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    legScopeKind: 'leg',
    legId: 'leg.long.btc',
    direction: 'long',
    instrumentRef: 'scope-symbol-1',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration scope.leg — golden corpus (Phase 5 S11 #1112)', () => {
  // ============================================================
  // Section A: NL pipeline
  // ============================================================
  describe('Section A: NL pipeline parseLegScope', () => {
    const gateway = new NaturalLanguageGatewayService()

    const fixtures: Array<{
      id: string
      utterance: string
      expectedLegCount: number
      expectsHedgePair?: boolean
      suppressSymbolScope?: boolean
    }> = [
      { id: 'F1', utterance: '做多 BTC 同时做空 ETH，等比对冲', expectedLegCount: 2, expectsHedgePair: true, suppressSymbolScope: true },
      { id: 'F2', utterance: 'BTCUSDT 多头腿、ETHUSDT 空头腿，1:2 对冲', expectedLegCount: 2 },
      { id: 'F3', utterance: 'Long BTC short ETH hedge', expectedLegCount: 2 },
      { id: 'F4', utterance: '三条腿：多 BTC、多 ETH、空 SOL', expectedLegCount: 3 },
      { id: 'F5', utterance: '对冲组合：BTC 做多 1000U、ETH 做空 500U', expectedLegCount: 2 },
      { id: 'F6', utterance: 'delta neutral 对冲：BTC 多 ETH 空 等比对冲', expectedLegCount: 2, expectsHedgePair: true },
    ]

    for (const fixture of fixtures) {
      it(`${fixture.id} produces leg_scope frame: "${fixture.utterance}"`, () => {
        const frames = gateway.parse(fixture.utterance)
        const leg = frames.find((f) => f.kind === 'leg_scope')
        expect(leg).toBeDefined()
        if (leg?.kind !== 'leg_scope') return
        expect(leg.legs.length).toBe(fixture.expectedLegCount)
        if (fixture.expectsHedgePair) {
          const directions = new Set(leg.legs.map((l) => l.direction))
          expect(directions.has('long')).toBe(true)
          expect(directions.has('short')).toBe(true)
        }
        if (fixture.suppressSymbolScope) {
          // F1 的"同时"会触发 S2 parseSymbolScope，但合流后 leg 优先 → suppress symbol_scope
          expect(frames.find((f) => f.kind === 'symbol_scope')).toBeUndefined()
        }
      })
    }

    it('negative: "做多 BTCUSDT 和 ETHUSDT" 不产 leg_scope frame（同向多 symbol）', () => {
      const frames = gateway.parse('做多 BTCUSDT 和 ETHUSDT')
      expect(frames.find((f) => f.kind === 'leg_scope')).toBeUndefined()
    })
  })

  // ============================================================
  // Section B: Readiness fail-closed
  // ============================================================
  describe('Section B: Readiness 8 重 fail-closed + binding fail-closed', () => {
    const readinessService = new SemanticContractReadinessService(
      undefined,
      undefined,
      undefined,
      new SemanticOrchestrationRegistryService(),
    )

    function readinessAfter(state: SemanticState): SemanticState {
      const r = readinessService.normalize(state, CURRENT_VERSION)
      return r.state
    }
    void readinessAfter
    void CURRENT_VERSION
    void readinessService

    it('B1 valid leg + locked scope.symbol → readiness 通过 leg locked', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [symbolScopeNode(), legScopeNode()],
          contracts: [],
        },
      })
      const next = readinessAfter(state)
      const leg = next.orchestration?.nodes.find((n) => n.kind === 'scope' && n.key === 'scope.leg')
      expect(leg?.status).toBe('locked')
    })

    it('B2 instrumentRef 引用不存在的 scope.symbol → leg fail-closed (status=open)', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [legScopeNode({ instrumentRef: 'nonexistent' })],
          contracts: [],
        },
      })
      const next = readinessAfter(state)
      const leg = next.orchestration?.nodes.find((n) => n.kind === 'scope' && n.key === 'scope.leg')
      expect(leg?.status).toBe('open')
      // isSupportedLegScope=false 走 phase0.unsupported；slot key 列表通过 registry.validate 单独覆盖
      expect(leg?.openSlots.length).toBeGreaterThan(0)
    })

    it('B3 direction 缺失 → registry.validate 报 direction slot', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const node = legScopeNode({ direction: undefined })
      const result = registry.validate(node, [symbolScopeNode()])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some((s) => s.slotKey === 'orchestration.scope.leg.direction')).toBe(true)
    })

    it('B4 legId 不合法 → registry.validate 报 leg_id slot', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const node = legScopeNode({ legId: '123-invalid' })
      const result = registry.validate(node, [symbolScopeNode()])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some((s) => s.slotKey === 'orchestration.scope.leg.leg_id')).toBe(true)
    })

    it('B5 paired direction collision → registry.validate 报 direction_collision slot', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const legA = legScopeNode({
        id: 'leg-A',
        legId: 'leg.A',
        direction: 'long',
        instrumentRef: 'scope-symbol-1',
        legSizing: { mode: 'fixed_ratio', value: 1, pairedLegId: 'leg.B' },
      })
      const legB = legScopeNode({
        id: 'leg-B',
        legId: 'leg.B',
        direction: 'long',  // same direction
        instrumentRef: 'scope-symbol-1',
      })
      const result = registry.validate(legA, [symbolScopeNode(), legB])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some((s) => s.slotKey === 'orchestration.scope.leg.direction_collision')).toBe(true)
    })

    it('B-binding 多 leg 策略 + trigger 缺 legScopeRef → 加 missing_binding', () => {
      const legA = legScopeNode({ id: 'leg-A', legId: 'leg.A', direction: 'long', instrumentRef: 'scope-symbol-1' })
      const legB = legScopeNode({ id: 'leg-B', legId: 'leg.B', direction: 'short', instrumentRef: 'scope-symbol-2' })
      const state = createSemanticState({
        triggers: [{
          id: 'tr-1',
          key: 'price.cross_above',
          phase: 'entry',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        }],
        orchestration: {
          nodes: [
            symbolScopeNode(),
            symbolScopeNode({ id: 'scope-symbol-2', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' }),
            legA,
            legB,
          ],
          contracts: [],
        },
      })
      const next = readinessAfter(state)
      const trigger = next.triggers.find((t) => t.id === 'tr-1')
      expect(trigger?.status).toBe('open')
      expect(trigger?.openSlots.some((s) => s.slotKey === 'orchestration.scope.leg.missing_binding')).toBe(true)
    })

    it('B-binding 单 leg 策略 → bypass binding（旧策略零侵入）', () => {
      const state = createSemanticState({
        triggers: [{
          id: 'tr-1',
          key: 'price.cross_above',
          phase: 'entry',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        }],
        orchestration: {
          nodes: [symbolScopeNode(), legScopeNode()],
          contracts: [],
        },
      })
      const next = readinessAfter(state)
      const trigger = next.triggers.find((t) => t.id === 'tr-1')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots.length).toBe(0)
    })
  })

  // ============================================================
  // Section C: Display 不泄漏内部 key
  // ============================================================
  describe('Section C: Display tokens 不泄漏内部 key', () => {
    const presentation = new SemanticPresentationRegistryService(new SemanticAtomRegistryService())

    it('publicName "策略腿" 通过 presentation entry', () => {
      const entry = presentation.getEntry('scope.leg')
      expect(entry?.publicName).toBe('策略腿')
    })

    it('display token zh 中文 — 不暴露 scope.leg/legScopeRef/legScopeKind', () => {
      const tokens = ['atom.scope.leg.name', 'atom.scope.leg.display.long', 'atom.scope.leg.display.short', 'atom.scope.leg.display.hedge']
      for (const tk of tokens) {
        const t = getDisplayToken(tk)
        expect(t).toBeDefined()
        expect(t?.zh ?? '').not.toContain('scope.leg')
        expect(t?.zh ?? '').not.toContain('legScopeRef')
        expect(t?.zh ?? '').not.toContain('legScopeKind')
      }
    })

    it('clarification 输出不包含内部 key', () => {
      const entry = presentation.getEntry('scope.leg')
      const text = entry?.clarificationRenderer?.('orchestration.scope.leg.missing_binding', {}) ?? ''
      expect(text).toContain('策略腿')
      expect(text).not.toContain('scope.leg')
      expect(text).not.toContain('legScopeRef')
    })
  })

  // ============================================================
  // Section D: canonical → IR → AST 全链路
  // ============================================================
  describe('Section D: canonical → IR → AST 全链路', () => {
    const builder = new CanonicalSpecBuilderService()
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    function withContextSlots(state: SemanticState): SemanticState {
      return {
        ...state,
        contextSlots: {
          exchange: { slotKey: 'context.exchange', fieldPath: 'context.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          symbol: { slotKey: 'context.symbol', fieldPath: 'context.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          marketType: { slotKey: 'context.marketType', fieldPath: 'context.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          timeframe: { slotKey: 'context.timeframe', fieldPath: 'context.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        },
      }
    }

    const irFallback = { exchange: 'binance' as const, symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 100 }

    it('D1 双腿对冲 supported → spec.orchestration.legScopes / IR.orchestrationLegScopes / AST.orchestrationLegScopes 全链路透传', () => {
      const state = withContextSlots(createSemanticState({
        orchestration: {
          nodes: [
            symbolScopeNode({ id: 's-btc', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' }),
            symbolScopeNode({ id: 's-eth', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' }),
            legScopeNode({ id: 'l-long', legId: 'leg.long.btc', direction: 'long', instrumentRef: 's-btc' }),
            legScopeNode({ id: 'l-short', legId: 'leg.short.eth', direction: 'short', instrumentRef: 's-eth' }),
          ],
          contracts: [],
        },
      }))
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.legScopes?.length).toBe(2)
      expect(spec.orchestration?.legScopes?.[0]?.legId).toBe('leg.long.btc')

      const ir = irCompiler.compile({ canonicalSpec: spec, fallback: irFallback })
      expect(ir.ir.orchestrationLegScopes?.length).toBe(2)

      const ast = astCompiler.compile(ir.ir)
      expect(ast.orchestrationLegScopes?.length).toBe(2)
    })

    it('D2 1-leg 兜底：builder 输出 1 leg；IR / AST 同形透传（仍走单 leg substrate runtime continue）', () => {
      const state = withContextSlots(createSemanticState({
        orchestration: {
          nodes: [symbolScopeNode(), legScopeNode()],
          contracts: [],
        },
      }))
      const spec = builder.buildFromSemanticState(state)
      const ir = irCompiler.compile({ canonicalSpec: spec, fallback: irFallback })
      expect(ir.ir.orchestrationLegScopes?.length ?? 0).toBe(1)
      const ast = astCompiler.compile(ir.ir)
      expect(ast.orchestrationLegScopes?.length).toBe(1)
    })
  })

  // ============================================================
  // Section E: runtime fail-closed 路由
  // ============================================================
  describe('Section E: runtime applyLegScopeRouting 5 case + 多 program', () => {
    function buildCtx(activeLegScopeId?: string): StrategyExecutionContextV1 {
      const ctx = {} as StrategyExecutionContextV1
      if (activeLegScopeId !== undefined) {
        (ctx as { activeLegScopeId?: string }).activeLegScopeId = activeLegScopeId
      }
      return ctx
    }

    const legScopes: readonly CompiledOrchestrationLegScope[] = [
      { id: 'leg-1', scopeKind: 'leg', legId: 'leg.long.btc', direction: 'long', instrumentRef: 's-btc' },
      { id: 'leg-2', scopeKind: 'leg', legId: 'leg.short.eth', direction: 'short', instrumentRef: 's-eth' },
    ]

    it('E1 单 leg / 0 leg → continue（兜底）', () => {
      expect(applyLegScopeRouting({ metadata: {} }, buildCtx(), undefined)).toBe('continue')
      expect(applyLegScopeRouting({ metadata: {} }, buildCtx(), [legScopes[0]])).toBe('continue')
    })

    it('E2 多 leg + ctx.activeLegScopeId 缺 → fail_closed.no_active_leg（直接 + 集成）', () => {
      // 直接调 applyLegScopeRouting
      const direct = applyLegScopeRouting({ metadata: { legScopeRef: 'leg-1' } }, buildCtx(), legScopes)
      expect(direct).toMatchObject({ action: 'NOOP', reason: 'compiled.orchestration.leg.fail_closed.no_active_leg' })
      // Mi2: 集成 runDecisionPrograms 断言 reason 是 leg.fail_closed 不被 symbol 覆盖
      const guardState: CompiledGuardState = { strategyHalt: false, forceExit: false, blockNewEntry: false, cancelOrderPrograms: false, triggered: [] }
      const exprValues = { 'pred-true': true as const }
      const programs = [{
        id: 'p-A',
        phase: 'entry' as const,
        priority: 1,
        when: 'pred-true',
        metadata: { legScopeRef: 'leg-1', symbolScopeRef: 's-btc' },
        actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
      }]
      const decision = runDecisionPrograms(buildCtx(), programs, exprValues, guardState, ['p-A'], undefined, undefined, undefined, legScopes)
      expect(decision.reason).toBe('compiled.orchestration.leg.fail_closed.no_active_leg')
    })

    it('E3 多 leg + activeId 不在集合 → fail_closed.unknown_active_leg（直接 + 集成）', () => {
      const direct = applyLegScopeRouting({ metadata: { legScopeRef: 'leg-1' } }, buildCtx('leg-99'), legScopes)
      expect(direct).toMatchObject({ action: 'NOOP', reason: 'compiled.orchestration.leg.fail_closed.unknown_active_leg' })
      const guardState: CompiledGuardState = { strategyHalt: false, forceExit: false, blockNewEntry: false, cancelOrderPrograms: false, triggered: [] }
      const exprValues = { 'pred-true': true as const }
      const programs = [{
        id: 'p-A', phase: 'entry' as const, priority: 1, when: 'pred-true',
        metadata: { legScopeRef: 'leg-1' },
        actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
      }]
      const decision = runDecisionPrograms(buildCtx('leg-99'), programs, exprValues, guardState, ['p-A'], undefined, undefined, undefined, legScopes)
      expect(decision.reason).toBe('compiled.orchestration.leg.fail_closed.unknown_active_leg')
    })

    it('E4 多 leg + program.metadata.legScopeRef 缺 → fail_closed.unbound_program（直接 + 集成）', () => {
      const direct = applyLegScopeRouting({ metadata: {} }, buildCtx('leg-1'), legScopes)
      expect(direct).toMatchObject({ action: 'NOOP', reason: 'compiled.orchestration.leg.fail_closed.unbound_program' })
      const guardState: CompiledGuardState = { strategyHalt: false, forceExit: false, blockNewEntry: false, cancelOrderPrograms: false, triggered: [] }
      const exprValues = { 'pred-true': true as const }
      const programs = [{
        id: 'p-A', phase: 'entry' as const, priority: 1, when: 'pred-true',
        metadata: {}, // missing legScopeRef
        actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
      }]
      const decision = runDecisionPrograms(buildCtx('leg-1'), programs, exprValues, guardState, ['p-A'], undefined, undefined, undefined, legScopes)
      expect(decision.reason).toBe('compiled.orchestration.leg.fail_closed.unbound_program')
    })

    it('E7 (W7) leg+symbol 双维度互不 short-circuit：leg continue → symbol routing 仍执行；symbol fail 时返 symbol fail reason', () => {
      // 配置：双 leg + 双 symbol；ctx.activeLegScopeId='leg-1'（leg 路由 continue），ctx.activeSymbolScopeId 缺（symbol 路由 fail-closed）
      const ctx = buildCtx('leg-1') as StrategyExecutionContextV1
      // 不设置 activeSymbolScopeId
      const guardState: CompiledGuardState = { strategyHalt: false, forceExit: false, blockNewEntry: false, cancelOrderPrograms: false, triggered: [] }
      const exprValues = { 'pred-true': true as const }
      const programs = [{
        id: 'p-A', phase: 'entry' as const, priority: 1, when: 'pred-true',
        metadata: { legScopeRef: 'leg-1', symbolScopeRef: 's-btc' },
        actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
      }]
      const symbolScopes: readonly CompiledOrchestrationScope[] = [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
        { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
      ]
      const decision = runDecisionPrograms(
        ctx, programs, exprValues, guardState, ['p-A'],
        undefined, undefined, symbolScopes, legScopes,
      )
      // leg continue → symbol routing 仍执行，命中 symbol no_active_scope
      expect(decision.action).toBe('NOOP')
      expect(decision.reason).toBe('compiled.orchestration.scope.fail_closed.no_active_scope')
      // 关键：reason 是 symbol 而非 leg（leg 路由已 continue 通过）
      expect(decision.reason).not.toContain('leg.fail_closed')
    })

    it('E5 多 leg + ref ≠ active → skip; ref === active → continue', () => {
      expect(applyLegScopeRouting({ metadata: { legScopeRef: 'leg-2' } }, buildCtx('leg-1'), legScopes)).toBe('skip')
      expect(applyLegScopeRouting({ metadata: { legScopeRef: 'leg-1' } }, buildCtx('leg-1'), legScopes)).toBe('continue')
    })

    it('E6 (W5) 多 program: A.legScopeRef=leg-1, B.legScopeRef=leg-2, active=leg-2 → A skip, B 进入决策核心', () => {
      const ctx = buildCtx('leg-2')
      const guardState: CompiledGuardState = {
        strategyHalt: false,
        forceExit: false,
        blockNewEntry: false,
        cancelOrderPrograms: false,
        triggered: [],
      }
      const exprValues = { 'pred-true': true as const }
      const programs = [
        {
          id: 'p-A',
          phase: 'entry' as const,
          priority: 1,
          when: 'pred-true',
          metadata: { legScopeRef: 'leg-1' },
          actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
        },
        {
          id: 'p-B',
          phase: 'entry' as const,
          priority: 2,
          when: 'pred-true',
          metadata: { legScopeRef: 'leg-2' },
          actions: [{ kind: 'OPEN_SHORT' as const, quantity: { mode: 'fixed_quote' as const, value: 100 } }],
        },
      ]
      const decision = runDecisionPrograms(
        ctx,
        programs,
        exprValues,
        guardState,
        ['p-A', 'p-B'],
        undefined,
        undefined,
        undefined,
        legScopes,
      )
      // A skip → B 进入决策核心 → OPEN_SHORT
      expect(decision.action).toBe('OPEN_SHORT')
      expect(decision.reason).toBe('compiled.p-B')
    })
  })
})
