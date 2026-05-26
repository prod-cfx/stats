import type { CompiledOrchestrationScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { OrchestrationGateState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import { applySymbolScopeRouting, runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import { CURRENT_SEMANTIC_VERSION, getDisplayToken, renderDisplayToken } from '../../nl-gateway'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'


/**
 * Phase 5 S2 (#1104): scope.symbol substrate 5 段集成 golden corpus
 *
 * Section A: NL pipeline parseSymbolScope 命中表 6 fixture + 1 negative
 * Section B: Readiness 6 重 fail-closed + binding fail-closed
 * Section C: Display 不泄漏内部 key
 * Section D: canonical → IR → AST 全链路 + 1-scope 兜底（N4）
 * Section E: runtime fail-closed 路由 5 case
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
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
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration scope.symbol — golden corpus (Phase 5 S2 Task 11)', () => {
  // ============================================================
  // Section A: NL pipeline
  // ============================================================
  describe('Section A: NL pipeline parseSymbolScope', () => {
    const gateway = new NaturalLanguageGatewayService()

    const positiveFixtures: Array<{ id: string; utterance: string; expectedSymbols: string[]; expectedPrimary?: string }> = [
      { id: 'F1', utterance: 'BTCUSDT 和 ETHUSDT 同时跑相同策略，均线金叉开多', expectedSymbols: ['BTCUSDT', 'ETHUSDT'] },
      { id: 'F2', utterance: '在 BTC 和 ETH 上挂网格', expectedSymbols: ['BTCUSDT', 'ETHUSDT'] },
      { id: 'F3', utterance: 'BTCUSDT、ETHUSDT、SOLUSDT 多个标的同时跑', expectedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] },
      { id: 'F4', utterance: 'BTCUSDT 主标的，ETHUSDT 跟随，均线金叉', expectedSymbols: ['BTCUSDT', 'ETHUSDT'], expectedPrimary: 'BTCUSDT' },
      { id: 'F5', utterance: 'Run BTCUSDT and ETHUSDT in parallel with same strategy', expectedSymbols: ['BTCUSDT', 'ETHUSDT'] },
      { id: 'F6', utterance: '跨标的（BTCUSDT/ETHUSDT/BNBUSDT）均挂网格', expectedSymbols: ['BNBUSDT', 'BTCUSDT', 'ETHUSDT'] },
    ]

    for (const fixture of positiveFixtures) {
      it(`${fixture.id} produces symbol_scope frame: "${fixture.utterance}"`, () => {
        const frames = gateway.parse(fixture.utterance)
        const scope = frames.find(f => f.kind === 'symbol_scope')
        expect(scope).toBeDefined()
        if (scope?.kind !== 'symbol_scope') return
        expect([...scope.symbols].sort()).toEqual([...fixture.expectedSymbols].sort())
        if (fixture.expectedPrimary) {
          expect(scope.primarySymbol).toBe(fixture.expectedPrimary)
        }
      })
    }

    it('negative: 单 symbol utterance 不产 symbol_scope frame', () => {
      const frames = gateway.parse('只交易 BTCUSDT，价格高于 EMA20 时开多')
      expect(frames.find(f => f.kind === 'symbol_scope')).toBeUndefined()
    })
  })

  // ============================================================
  // Section B: Readiness fail-closed
  // ============================================================
  describe('Section B: Readiness fail-closed', () => {
    const readinessService = new SemanticContractReadinessService(
      undefined,
      undefined,
      undefined,
      new SemanticOrchestrationRegistryService(),
    )

    it('B1 kind ≠ scope → unsupported', () => {
      const node = symbolScopeNode({ kind: 'gate' })
      const state = createSemanticState({ orchestration: [node], orchestrationContracts: [] })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      // gate kind 走兜底 phase0 unsupported（既有路径），symbols 不参与 supported scope set
      expect(result.ready).toBe(false)
    })

    it('B2 key ≠ scope.symbol → unsupported_kind slot', () => {
      const node = symbolScopeNode({ key: 'scope.timeframe' })
      const state = createSemanticState({ orchestration: [node], orchestrationContracts: [] })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B3 symbolScopeKind ≠ symbol → unsupported', () => {
      const node = symbolScopeNode({ symbolScopeKind: undefined })
      const state = createSemanticState({ orchestration: [node], orchestrationContracts: [] })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B4 symbols 含非法格式 → fail-closed', () => {
      const node = symbolScopeNode({ symbols: ['btc-usdt'] }) // 小写 + 短横，违反 ^[A-Z]{2,5}USDT$
      const state = createSemanticState({ orchestration: [node], orchestrationContracts: [] })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B5 primarySymbol 不在 symbols → fail-closed', () => {
      const node = symbolScopeNode({ symbols: ['BTCUSDT', 'ETHUSDT'], primarySymbol: 'SOLUSDT' })
      const state = createSemanticState({ orchestration: [node], orchestrationContracts: [] })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B6a 双 scope symbols 重叠 → registry symbols_overlap fail-closed', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const scope1 = symbolScopeNode({ id: 's-1', symbols: ['BTCUSDT', 'ETHUSDT'], primarySymbol: 'BTCUSDT' })
      const scope2 = symbolScopeNode({ id: 's-2', symbols: ['ETHUSDT', 'SOLUSDT'], primarySymbol: 'SOLUSDT' })
      const result = registry.validate(scope2, [scope1, scope2])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.find(s => s.slotKey === 'orchestration.scope.symbol.symbols_overlap')).toBeDefined()
    })

    it('B6b 双 scope primarySymbol 冲突 → registry primary_symbol_collision fail-closed', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const scope1 = symbolScopeNode({ id: 's-1', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' })
      // primarySymbol BTCUSDT 与 scope1 冲突；symbols 故意不重叠以让 collision 单独触发
      const scope2 = symbolScopeNode({ id: 's-2', symbols: ['ETHUSDT', 'BTCUSDT'], primarySymbol: 'BTCUSDT' })
      const result = registry.validate(scope2, [scope1, scope2])
      expect(result.ok).toBe(false)
      // 同时会触发 symbols_overlap，但本 spec 关心 primary_symbol_collision 也命中
      const collisionSlot = result.missingSlots.find(s => s.slotKey === 'orchestration.scope.symbol.primary_symbol_collision')
      expect(collisionSlot).toBeDefined()
    })

    it('B6 双 scope locked + trigger 缺 symbolScopeRef → missing_binding', () => {
      const scopeBtc = symbolScopeNode({ id: 's-btc', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' })
      const scopeEth = symbolScopeNode({ id: 's-eth', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' })
      const state = createSemanticState({
        orchestration: [scopeBtc, scopeEth], orchestrationContracts: [],
        trigger: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.trigger[0]
      expect(trigger.status).toBe('open')
      const slot = trigger.openSlots.find(s => s.slotKey === 'orchestration.scope.symbol.missing_binding')
      expect(slot).toBeDefined()
    })
  })

  // ============================================================
  // Section C: Display 不泄漏
  // ============================================================
  describe('Section C: Display 不泄漏内部 key', () => {
    it('双 scope.symbol locked → display 含 "标的范围：BTCUSDT、ETHUSDT"，不含字面 key', () => {
      // public name token
      expect(getDisplayToken('atom.scope.symbol.name').zh).toBe('标的范围')
      // render with primary
      const display = renderDisplayToken('atom.scope.symbol.display.with_primary', {
        symbols: 'BTCUSDT、ETHUSDT', primarySymbol: 'BTCUSDT',
      })
      expect(display).toBe('标的范围：BTCUSDT、ETHUSDT（主：BTCUSDT）')
      expect(display).not.toContain('scope.symbol')
    })

    it('clarification token slot keys 全部命中', () => {
      // missing_binding 是多 scope 关键 fail-closed 提示
      expect(getDisplayToken('slot.orchestration.scope.symbol.missing_binding').zh).toBe(
        '请确认该规则绑定到哪个 symbol scope',
      )
      // overlap / collision 触发 registry 强制隔离
      expect(getDisplayToken('slot.orchestration.scope.symbol.symbols_overlap').zh).toBe(
        '多 scope 之间标的不能重叠',
      )
      expect(getDisplayToken('slot.orchestration.scope.symbol.primary_symbol_collision').zh).toBe(
        '多 scope 主标的必须各自唯一',
      )
    })
  })

  // ============================================================
  // Section D: canonical → IR → AST 全链路
  // ============================================================
  describe('Section D: canonical → IR → AST 全链路 + 1-scope 兜底（N4）', () => {
    const builder = new CanonicalSpecBuilderService()
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    it('D1 双 scope.symbol → spec.orchestration.scopes / IR.orchestrationScopes / AST.orchestrationScopes 透传', () => {
      const scopeBtc = symbolScopeNode({ id: 's-btc', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' })
      const scopeEth = symbolScopeNode({ id: 's-eth', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' })
      const state = createSemanticState({
        orchestration: [scopeBtc, scopeEth], orchestrationContracts: [],
        contextSlots: {
          exchange: { slotKey: 'context.exchange', fieldPath: 'context.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          symbol: { slotKey: 'context.symbol', fieldPath: 'context.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          marketType: { slotKey: 'context.marketType', fieldPath: 'context.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          timeframe: { slotKey: 'context.timeframe', fieldPath: 'context.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        },
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes?.length).toBe(2)
      expect(spec.orchestration?.scopes?.[0].id).toBeDefined()

      const ir = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 100 },
      })
      expect(ir.ir.orchestrationScopes?.length).toBe(2)

      const ast = astCompiler.compile(ir.ir)
      expect(ast.orchestrationScopes?.length).toBe(2)
    })

    it('D2 (N4) 0 scope locked → spec.orchestration.scopes 缺省', () => {
      const state = createSemanticState({
        contextSlots: {
          exchange: { slotKey: 'context.exchange', fieldPath: 'context.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          symbol: { slotKey: 'context.symbol', fieldPath: 'context.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          marketType: { slotKey: 'context.marketType', fieldPath: 'context.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          timeframe: { slotKey: 'context.timeframe', fieldPath: 'context.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        },
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes).toBeUndefined()
    })

    it('D3 (N4) 1 scope locked → spec 含单 scope；无 binding 检查', () => {
      const scopeBtc = symbolScopeNode({ id: 's-btc', symbols: ['BTCUSDT'] })
      const state = createSemanticState({
        orchestration: [scopeBtc], orchestrationContracts: [],
        contextSlots: {
          exchange: { slotKey: 'context.exchange', fieldPath: 'context.exchange', value: 'binance', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          symbol: { slotKey: 'context.symbol', fieldPath: 'context.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          marketType: { slotKey: 'context.marketType', fieldPath: 'context.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
          timeframe: { slotKey: 'context.timeframe', fieldPath: 'context.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        },
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes?.length).toBe(1)
    })
  })

  // ============================================================
  // Section E: runtime fail-closed 路由
  // ============================================================
  describe('Section E: runtime fail-closed 路由（5 case）', () => {
    const noopGuard: CompiledGuardState = {
      blockNewEntry: false, forceExit: false, strategyHalt: false,
      cancelOrderPrograms: false, triggered: [],
    }
    const noopGate: OrchestrationGateState = {
      blockEntryLong: false, blockEntryShort: false,
    }
    const noopPortfolio: OrchestrationPortfolioRiskState = {
      blockEntryLong: false, blockEntryShort: false, observedBreaches: [],
    }
    const baseProgram = {
      id: 'p1',
      phase: 'entry' as const,
      priority: 1,
      when: 'expr_true',
      metadata: {} as { symbolScopeRef?: string },
      actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
    }
    const exprValues = { expr_true: true } as const
    const ctx: StrategyExecutionContextV1 = { symbol: 'BTCUSDT' }
    const scopes: CompiledOrchestrationScope[] = [
      { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
      { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ]

    it('E1 单 scope (length=1) → 路由兜底 continue', () => {
      const result = applySymbolScopeRouting(
        { metadata: { symbolScopeRef: 'whatever' } },
        ctx,
        [scopes[0]],
      )
      expect(result).toBe('continue')
    })

    it('E2 双 scope + 缺 activeSymbolScopeId → fail-closed.no_active_scope', () => {
      const result = applySymbolScopeRouting(baseProgram, ctx, scopes)
      expect(typeof result === 'object' && (result as StrategyDecisionV1).reason).toBe(
        'compiled.orchestration.scope.fail_closed.no_active_scope',
      )
    })

    it('E3 双 scope + 错误 activeSymbolScopeId → fail-closed.unknown_active_scope', () => {
      const ctx2 = { ...ctx, activeSymbolScopeId: 's-unknown' }
      const result = applySymbolScopeRouting(baseProgram, ctx2, scopes)
      expect(typeof result === 'object' && (result as StrategyDecisionV1).reason).toBe(
        'compiled.orchestration.scope.fail_closed.unknown_active_scope',
      )
    })

    it('E4 双 scope + program 缺 symbolScopeRef → fail-closed.unbound_program', () => {
      const ctx2 = { ...ctx, activeSymbolScopeId: 's-btc' }
      const result = applySymbolScopeRouting(baseProgram, ctx2, scopes)
      expect(typeof result === 'object' && (result as StrategyDecisionV1).reason).toBe(
        'compiled.orchestration.scope.fail_closed.unbound_program',
      )
    })

    it('E5 双 scope + program ref ≠ activeId → skip；ref === activeId → continue', () => {
      const ctx2 = { ...ctx, activeSymbolScopeId: 's-btc' }
      const programBtc = { metadata: { symbolScopeRef: 's-btc' } }
      const programEth = { metadata: { symbolScopeRef: 's-eth' } }
      expect(applySymbolScopeRouting(programBtc, ctx2, scopes)).toBe('continue')
      expect(applySymbolScopeRouting(programEth, ctx2, scopes)).toBe('skip')
    })

    it('E6 runDecisionPrograms 全 program skip → 兜底 NOOP compiled.noop', () => {
      const ctx2 = { ...ctx, activeSymbolScopeId: 's-btc' } as StrategyExecutionContextV1
      const programs = [{
        ...baseProgram,
        metadata: { symbolScopeRef: 's-eth' }, // ref 与 active 不一致
      }]
      const decision = runDecisionPrograms(
        ctx2, programs, exprValues, noopGuard, ['p1'], noopGate, noopPortfolio, scopes,
      )
      expect(decision.action).toBe('NOOP')
      expect(decision.reason).toBe('compiled.noop')
    })

    it('E7 forceExit + 缺 activeSymbolScopeId → CLOSE_LONG 强平（M4 forceExit 优先）', () => {
      const guardForceExit: CompiledGuardState = {
        blockNewEntry: false, forceExit: true, strategyHalt: false,
        cancelOrderPrograms: false, triggered: [],
      }
      const ctx2 = {
        ...ctx,
        position: { qty: 1, side: 'long' as const },
      } as StrategyExecutionContextV1
      const decision = runDecisionPrograms(
        ctx2, [baseProgram], exprValues, guardForceExit, ['p1'], noopGate, noopPortfolio, scopes,
      )
      expect(decision.action).toBe('CLOSE_LONG')
    })
  })
})
