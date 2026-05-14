import type { CompiledOrchestrationPortfolioRisk } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'

import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

/**
 * Phase 5 S8 (#1119): portfolioRisk.symbol_exposure_cap golden corpus
 *
 * 5 段集成 spec（与 S7 drawdown_block golden corpus 对称）：
 *   A. NL → frame → patch → state pipeline
 *   B. Readiness 10 fail-closed branches
 *   C. Display 不泄漏内部 key（含 W2 缺 state node 不渲染）
 *   D. Canonical → IR → evaluator 全链路（含 enforce vs observe 分岔）
 *   E. 老策略（仅 drawdown）+ symbol_exposure_cap 新节点不影响老策略语义
 *
 * 注：B/D 段直接构造 SemanticState，避免依赖完整 NL pipeline；
 * 只有 A 段验证 NL pipeline 端到端贯通。
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

const SYMBOL_SCOPE_ID = 'orchestration-scope-symbol-btcusdt-1'

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
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...overrides,
  }
}

/** 一个 status='locked' 的 scope.symbol 节点，供 readiness check (10) 使用 */
function symbolScopeNode(id = SYMBOL_SCOPE_ID): SemanticOrchestrationNode {
  return {
    id,
    kind: 'scope',
    key: 'scope.symbol',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    // Required by isSupportedSymbolScope so the node stays 'locked' after readiness pass
    symbolScopeKind: 'symbol',
    symbols: ['BTCUSDT'],
    openSlots: [],
    contracts: [],
  }
}

function symbolCapNode(
  overrides: Partial<SemanticOrchestrationNode> = {},
): SemanticOrchestrationNode {
  return {
    id: 'orchestration-portfolio-risk-symbol-cap-1',
    kind: 'portfolioRisk',
    key: 'portfolioRisk.symbol_exposure_cap',
    status: 'locked',
    source: 'user_explicit',
    params: { notionalCapPct: 30, mode: 'enforce' },
    scope: 'symbol',
    mode: 'enforce',
    notionalCapPct: 30,
    effectWhenTriggered: 'block_new_entries',
    boundSymbolScopeRef: SYMBOL_SCOPE_ID,
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration portfolioRisk.symbol_exposure_cap — golden corpus (Phase 5 S8 #1119)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline
  // ============================================================
  describe('Section A: NL pipeline', () => {
    it('A.1 parses "单标的仓位敞口不超过 30%" into portfolio_symbol_exposure_cap frame', () => {
      const gateway = new NaturalLanguageGatewayService()
      const normalizer = new SemanticFrameNormalizerService()
      const builder = new SemanticSeedStateBuilderService()

      const frames = gateway.parse('单标的仓位敞口不超过 30%')
      const capFrames = frames.filter(f => f.kind === 'portfolio_symbol_exposure_cap')
      expect(capFrames).toHaveLength(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_symbol_exposure_cap') {
        expect(frame.notionalCapPct).toBe(30)
        expect(frame.mode).toBe('enforce')
        expect(frame.effect).toBe('block_new_entries')
      }

      const patch = normalizer.normalize(frames)
      const node = patch.orchestration?.nodes.find(n => n.key === 'portfolioRisk.symbol_exposure_cap')
      expect(node).toBeDefined()
      if (node?.kind === 'portfolioRisk' && node.key === 'portfolioRisk.symbol_exposure_cap') {
        expect(node.scope).toBe('symbol')
        expect(node.mode).toBe('enforce')
        expect(node.notionalCapPct).toBe(30)
        expect(node.effectWhenTriggered).toBe('block_new_entries')
      }

      const state = builder.build(patch)
      expect(state).not.toBeNull()
      const stateNode = state!.orchestration.find(n => n.key === 'portfolioRisk.symbol_exposure_cap')
      expect(stateNode).toBeDefined()
      expect(stateNode?.kind).toBe('portfolioRisk')
      expect(stateNode?.scope).toBe('symbol')
      expect(stateNode?.mode).toBe('enforce')
      expect(stateNode?.notionalCapPct).toBe(30)
      expect(stateNode?.status).toBe('locked')
    })

    it('A.2 "标的敞口 20% 仅记录" → observe mode + block_new_entries effect', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('标的敞口 20% 仅记录')
      const capFrames = frames.filter(f => f.kind === 'portfolio_symbol_exposure_cap')
      expect(capFrames.length).toBeGreaterThanOrEqual(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_symbol_exposure_cap') {
        expect(frame.notionalCapPct).toBe(20)
        expect(frame.mode).toBe('observe')
      }
    })

    it('A.3 "单标的敞口超过 25% 缩减仓位" → reduce_exposure effect', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('单标的敞口超过 25% 缩减仓位')
      const capFrames = frames.filter(f => f.kind === 'portfolio_symbol_exposure_cap')
      expect(capFrames.length).toBeGreaterThanOrEqual(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_symbol_exposure_cap') {
        expect(frame.notionalCapPct).toBe(25)
        expect(frame.effect).toBe('reduce_exposure')
      }
    })

    it('A.4 dedup: same pct+mode+effect appears only once in frames', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('单标的敞口不超过 30%，标的仓位上限 30%')
      const capFrames = frames.filter(f => f.kind === 'portfolio_symbol_exposure_cap')
      // dedup by notionalCapPct + mode + effect → should be 1
      expect(capFrames.filter(f =>
        f.kind === 'portfolio_symbol_exposure_cap'
        && (f as { notionalCapPct: number }).notionalCapPct === 30,
      )).toHaveLength(1)
    })
  })

  // ============================================================
  // Section B — Readiness 10 fail-closed branches
  // ============================================================
  describe('Section B: readiness fail-closed branches', () => {
    const readiness = () => new SemanticContractReadinessService()

    it('B.1 valid node + sibling scope.symbol locked + 新策略 → no phase0 unsupported slot', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode()],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).not.toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.2 scope !== "symbol" → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ scope: 'portfolio' as SemanticOrchestrationNode['scope'] })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.3 invalid mode → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ mode: 'unknown' as SemanticOrchestrationNode['mode'] })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.4 notionalCapPct=0 (≤0) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ notionalCapPct: 0 })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.5 notionalCapPct=150 (>100) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ notionalCapPct: 150 })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.6 invalid effectWhenTriggered (pause_substrategy is not valid for symbol) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ effectWhenTriggered: 'pause_substrategy' })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.7 boundSymbolScopeRef empty → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode({ boundSymbolScopeRef: '' })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.8 boundSymbolScopeRef not matching any sibling scope.symbol id → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode('different-id'), symbolCapNode({ boundSymbolScopeRef: 'nonexistent-scope-id' })],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.9 sibling scope.symbol exists but status=open (not locked) → phase0 unsupported', () => {
      const unlockedScope = { ...symbolScopeNode(), status: 'open' as const }
      const state = createSemanticState({
        orchestration: [unlockedScope, symbolCapNode()],
        orchestrationContracts: [],
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.10 老策略 (deployedAtSemanticVersion=null) → phase0 unsupported（version-gate fail-closed）', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode()],
        orchestrationContracts: [],
      })
      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = readiness().normalize(state, legacy)
      const slots = result.state.orchestration
        .find(n => n.key === 'portfolioRisk.symbol_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })
  })

  // ============================================================
  // Section C — Display does not leak internal keys (W2)
  // ============================================================
  describe('Section C: display projection invariants', () => {
    const projection = new SemanticStateProjectionService()

    it('C.1 supported symbol_exposure_cap renders 中文 label without leaking internal keys', () => {
      const state = createSemanticState({
        orchestration: [symbolScopeNode(), symbolCapNode()],
        orchestrationContracts: [],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      const orchestrationBlocks = graph.blocks.filter(b => b.type === 'ORCHESTRATION')
      expect(orchestrationBlocks).toHaveLength(1)

      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      // Should contain cap percentage
      expect(flat).toContain('30')
      // Must not leak internal keys
      expect(flat).not.toContain('portfolioRisk.symbol_exposure_cap')
      expect(flat).not.toContain('orchestration.')
      expect(flat).not.toContain('symbol_exposure_cap')
      expect(flat).not.toContain('block_new_entries')
      expect(flat).not.toContain('reduce_exposure')
    })

    it('C.2 W2: 无 orchestration nodes → display 无 ORCHESTRATION block', () => {
      const state = createSemanticState({
        normalizationNotes: ['标的敞口不超过 30%'],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      expect(graph.blocks.filter(b => b.type === 'ORCHESTRATION')).toHaveLength(0)
    })

    it('C.3 observe mode renders distinct token from enforce mode (no "enforce" text leak)', () => {
      const state = createSemanticState({
        orchestration: [
            symbolScopeNode(),
            symbolCapNode({ mode: 'observe', params: { notionalCapPct: 30, mode: 'observe' } }),
          ],
        orchestrationContracts: [],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      expect(flat).not.toContain('enforce')
      expect(flat).not.toContain('block_new_entries')
    })
  })

  // ============================================================
  // Section D — Canonical → IR → evaluator
  // ============================================================
  describe('Section D: canonical → IR → evaluator', () => {
    function buildPipeline(nodeOverrides: Partial<SemanticOrchestrationNode> = {}) {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()

      const state = createSemanticState({
        contextSlots: {
          exchange: null,
          symbol: {
            slotKey: 'context.symbol',
            fieldPath: 'symbol',
            value: 'BTCUSDT',
            status: 'locked',
            priority: 'context',
            questionHint: '交易标的',
            affectsExecution: true,
          },
          marketType: null,
          timeframe: {
            slotKey: 'context.timeframe',
            fieldPath: 'timeframe',
            value: '1m',
            status: 'locked',
            priority: 'context',
            questionHint: 'K 线周期',
            affectsExecution: true,
          },
        },
        position: {
          mode: 'fixed_quote',
          value: 10,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        orchestration: [symbolScopeNode(), symbolCapNode(nodeOverrides)],
        orchestrationContracts: [],
      })

      const spec = builder.buildFromSemanticState(state)
      const ir = compiler.compile({
        canonicalSpec: spec,
        fallback: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          positionPct: 10,
        },
      }).ir
      return { spec, ir }
    }

    it('D.1 spec.orchestration.portfolioRisks 1 条 symbol scope + IR 透传正确', () => {
      const { spec, ir } = buildPipeline()
      const specRisks = spec.orchestration?.portfolioRisks ?? []
      expect(specRisks).toHaveLength(1)
      expect(specRisks[0]).toEqual(expect.objectContaining({
        scope: 'symbol',
        mode: 'enforce',
        notionalCapPct: 30,
        effectWhenTriggered: 'block_new_entries',
      }))

      const irRisks = ir.orchestrationPortfolioRisks ?? []
      expect(irRisks).toHaveLength(1)
      expect(irRisks[0]).toEqual(expect.objectContaining({
        scope: 'symbol',
        mode: 'enforce',
        notionalCapPct: 30,
        effectWhenTriggered: 'block_new_entries',
      }))
      expect(typeof irRisks[0].id).toBe('string')
      expect((irRisks[0] as { symbolScopeRef?: string }).symbolScopeRef).toBe(SYMBOL_SCOPE_ID)
    })

    it('D.2 evaluator: enforce + ratio=40% > cap=30% → blockedSymbolScopeRefs', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySymbolScope: { [SYMBOL_SCOPE_ID]: 4000 },
        accountEquity: 10000,
      })
      expect(result.blockEntryLong).toBe(false) // scoped, not global
      expect(result.blockEntryShort).toBe(false)
      const blocked = result.blockedSymbolScopeRefs
      expect(blocked?.has(SYMBOL_SCOPE_ID)).toBe(true)
    })

    it('D.3 evaluator: enforce + ratio=20% < cap=30% → no block', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySymbolScope: { [SYMBOL_SCOPE_ID]: 2000 },
        accountEquity: 10000,
      })
      expect(result.blockEntryLong).toBe(false)
      expect(result.blockEntryShort).toBe(false)
      expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
      expect(result.observedBreaches).toEqual([])
    })

    it('D.4 evaluator: observe + ratio > cap → observedBreaches only (no block)', () => {
      const { ir } = buildPipeline({
        mode: 'observe',
        params: { notionalCapPct: 30, mode: 'observe' },
      })
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect(risks[0].mode).toBe('observe')
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySymbolScope: { [SYMBOL_SCOPE_ID]: 4000 },
        accountEquity: 10000,
      })
      expect(result.blockEntryLong).toBe(false)
      expect(result.blockEntryShort).toBe(false)
      expect(result.observedBreaches).toContain(risks[0].id)
      expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    })

    it('D.5 evaluator: reduce_exposure + ratio=40% > cap=30% → factor=0.75 in reduceFactorBySymbolScope', () => {
      const { ir } = buildPipeline({
        effectWhenTriggered: 'reduce_exposure',
        params: { notionalCapPct: 30, mode: 'enforce' },
      })
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect((risks[0] as { effectWhenTriggered: string }).effectWhenTriggered).toBe('reduce_exposure')
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySymbolScope: { [SYMBOL_SCOPE_ID]: 4000 },
        accountEquity: 10000,
      })
      expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
      const factor = result.reduceFactorBySymbolScope?.[SYMBOL_SCOPE_ID]
      expect(factor).toBeCloseTo(0.75, 5)
    })
  })

  // ============================================================
  // Section E — Old strategy (drawdown only) unaffected
  // ============================================================
  describe('Section E: old strategy (drawdown_block only) regression', () => {
    it('E.1 drawdown-only spec produces 1 portfolio-scope risk, symbol_exposure_cap absent → evaluator unchanged', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()

      const drawdownNode: SemanticOrchestrationNode = {
        id: 'orchestration-portfolio-risk-drawdown-1',
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
        status: 'locked',
        source: 'user_explicit',
        params: { thresholdPct: 10, mode: 'enforce' },
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
        openSlots: [],
        contracts: [],
      }

      const state = createSemanticState({
        contextSlots: {
          exchange: null,
          symbol: {
            slotKey: 'context.symbol',
            fieldPath: 'symbol',
            value: 'BTCUSDT',
            status: 'locked',
            priority: 'context',
            questionHint: '交易标的',
            affectsExecution: true,
          },
          marketType: null,
          timeframe: {
            slotKey: 'context.timeframe',
            fieldPath: 'timeframe',
            value: '1m',
            status: 'locked',
            priority: 'context',
            questionHint: 'K 线周期',
            affectsExecution: true,
          },
        },
        position: {
          mode: 'fixed_quote',
          value: 10,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        orchestration: [drawdownNode], orchestrationContracts: [],
      })

      const spec = builder.buildFromSemanticState(state)
      const ir = compiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance' as const, symbol: 'BTCUSDT', baseTimeframe: '1m', positionPct: 10 },
      }).ir

      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect(risks).toHaveLength(1)
      expect(risks[0].scope).toBe('portfolio')
      expect(risks.find(r => r.scope === 'symbol')).toBeUndefined()

      // Old evaluator path still works: drawdown=12% > threshold=10% → block
      const evalResult = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: 12 })
      expect(evalResult.blockEntryLong).toBe(true)
      expect(evalResult.blockEntryShort).toBe(true)
      expect(evalResult.blockedSymbolScopeRefs).toBeUndefined()
    })

    it('E.2 symbol_exposure_cap enforce 仅拦截 OPEN_*；exit phase 不受影响', () => {
      type Programs = Parameters<typeof runDecisionPrograms>[1]
      type Ctx = Parameters<typeof runDecisionPrograms>[0]
      type Guard = Parameters<typeof runDecisionPrograms>[3]

      const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

      const CLOSE_SHORT_PROGRAM = {
        id: 'program_close_short',
        phase: 'exit' as const,
        priority: 100,
        when: 'predicate_close_short',
        actions: [{ kind: 'CLOSE_SHORT' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
      }

      const SYMBOL_RISK: CompiledOrchestrationPortfolioRisk = {
        id: 'risk-sym-1',
        scope: 'symbol',
        mode: 'enforce',
        notionalCapPct: 30,
        symbolScopeRef: SYMBOL_SCOPE_ID,
        effectWhenTriggered: 'block_new_entries',
      }

      const ctx = {
        position: { qty: -1 },
        currentPrice: 100,
        accountEquity: 10000,
        __compiledDecisionState: { previousPositionQty: -1, lastTriggeredByProgram: {}, barIndex: 0 },
        semanticRuntimeState: {},
      } as unknown as Ctx

      const exprValues = { predicate_close_short: true }
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks([SYMBOL_RISK], {
        exposureNotionalBySymbolScope: { [SYMBOL_SCOPE_ID]: 4000 },
        accountEquity: 10000,
      })
      expect(portfolioRiskState.blockedSymbolScopeRefs?.has(SYMBOL_SCOPE_ID)).toBe(true)

      const decision = runDecisionPrograms(
        ctx,
        [CLOSE_SHORT_PROGRAM] as unknown as Programs,
        exprValues as never,
        baseGuard,
        [CLOSE_SHORT_PROGRAM.id],
        undefined,
        portfolioRiskState,
      )

      // Exit programs are not blocked by scoped symbol exposure cap
      expect(decision.action).toBe('CLOSE_SHORT')
    })
  })
})
