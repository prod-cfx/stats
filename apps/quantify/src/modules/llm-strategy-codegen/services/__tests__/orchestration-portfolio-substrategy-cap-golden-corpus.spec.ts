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
 * Phase 5 S8 (#1119): portfolioRisk.substrategy_exposure_cap golden corpus
 *
 * 5 段集成 spec（与 symbol_exposure_cap golden corpus 对称）：
 *   A. NL → frame → patch → state pipeline
 *   B. Readiness 10 fail-closed branches
 *   C. Display 不泄漏内部 key（含 W2 缺 state node 不渲染）
 *   D. Canonical → IR → evaluator 全链路（含 pause vs block 分岔）
 *   E. 老策略（仅 drawdown）+ substrategy_exposure_cap 新节点不影响老策略语义
 *
 * 注：B/D 段直接构造 SemanticState；只有 A 段验证 NL pipeline 端到端贯通。
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

const SUBSTRATEGY_SCOPE_ID = 'orchestration-scope-substrategy-trend-1'

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
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

/** 一个 status='locked' 的 scope.subStrategy 节点，供 readiness check (10) 使用 */
function subStrategyScopeNode(id = SUBSTRATEGY_SCOPE_ID): SemanticOrchestrationNode {
  return {
    id,
    kind: 'scope',
    key: 'scope.subStrategy',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    // Required by isSupportedSubStrategyScope so the node stays 'locked' after readiness pass
    subStrategyScopeKind: 'subStrategy',
    subStrategyId: 'trend-following',
    positionHandlingOnDeactivate: 'close',
    orderHandlingOnDeactivate: 'cancel',
    openSlots: [],
    contracts: [],
  }
}

function subStrategyCapNode(
  overrides: Partial<SemanticOrchestrationNode> = {},
): SemanticOrchestrationNode {
  return {
    id: 'orchestration-portfolio-risk-substrategy-cap-1',
    kind: 'portfolioRisk',
    key: 'portfolioRisk.substrategy_exposure_cap',
    status: 'locked',
    source: 'user_explicit',
    params: { notionalCapPct: 40, mode: 'enforce' },
    scope: 'subStrategy',
    mode: 'enforce',
    notionalCapPct: 40,
    effectWhenTriggered: 'pause_substrategy',
    boundSubStrategyScopeRef: SUBSTRATEGY_SCOPE_ID,
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration portfolioRisk.substrategy_exposure_cap — golden corpus (Phase 5 S8 #1119)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline
  // ============================================================
  describe('Section A: NL pipeline', () => {
    it('A.1 parses "子策略敞口不超过 40%" into portfolio_substrategy_exposure_cap frame', () => {
      const gateway = new NaturalLanguageGatewayService()
      const normalizer = new SemanticFrameNormalizerService()
      const builder = new SemanticSeedStateBuilderService()

      const frames = gateway.parse('子策略敞口不超过 40%')
      const capFrames = frames.filter(f => f.kind === 'portfolio_substrategy_exposure_cap')
      expect(capFrames).toHaveLength(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_substrategy_exposure_cap') {
        expect(frame.notionalCapPct).toBe(40)
        expect(frame.mode).toBe('enforce')
        expect(frame.effect).toBe('block_new_entries')
      }

      const patch = normalizer.normalize(frames)
      const node = patch.orchestration?.nodes.find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')
      expect(node).toBeDefined()
      if (node?.kind === 'portfolioRisk' && node.key === 'portfolioRisk.substrategy_exposure_cap') {
        expect(node.scope).toBe('subStrategy')
        expect(node.mode).toBe('enforce')
        expect(node.notionalCapPct).toBe(40)
      }

      const state = builder.build(patch)
      expect(state).not.toBeNull()
      const stateNode = state!.orchestration?.nodes.find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')
      expect(stateNode).toBeDefined()
      expect(stateNode?.kind).toBe('portfolioRisk')
      expect(stateNode?.scope).toBe('subStrategy')
      expect(stateNode?.mode).toBe('enforce')
      expect(stateNode?.notionalCapPct).toBe(40)
      expect(stateNode?.status).toBe('locked')
    })

    it('A.2 "子策略仓位超 35% 暂停" → pause_substrategy effect', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('子策略仓位超 35% 暂停')
      const capFrames = frames.filter(f => f.kind === 'portfolio_substrategy_exposure_cap')
      expect(capFrames.length).toBeGreaterThanOrEqual(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_substrategy_exposure_cap') {
        expect(frame.notionalCapPct).toBe(35)
        expect(frame.effect).toBe('pause_substrategy')
      }
    })

    it('A.3 "sub-strategy exposure 50% 仅记录" → observe mode', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('sub-strategy exposure 50% 仅记录')
      const capFrames = frames.filter(f => f.kind === 'portfolio_substrategy_exposure_cap')
      expect(capFrames.length).toBeGreaterThanOrEqual(1)
      const frame = capFrames[0]
      if (frame.kind === 'portfolio_substrategy_exposure_cap') {
        expect(frame.notionalCapPct).toBe(50)
        expect(frame.mode).toBe('observe')
      }
    })

    it('A.4 dedup: same pct+mode+effect appears only once in frames', () => {
      const gateway = new NaturalLanguageGatewayService()
      const frames = gateway.parse('子策略敞口不超过 40%，子策略仓位上限 40%')
      const capFrames = frames.filter(f => f.kind === 'portfolio_substrategy_exposure_cap')
      expect(capFrames.filter(f =>
        f.kind === 'portfolio_substrategy_exposure_cap'
        && (f as { notionalCapPct: number }).notionalCapPct === 40,
      )).toHaveLength(1)
    })
  })

  // ============================================================
  // Section B — Readiness 10 fail-closed branches
  // ============================================================
  describe('Section B: readiness fail-closed branches', () => {
    const readiness = () => new SemanticContractReadinessService()

    it('B.1 valid node + sibling scope.subStrategy locked + 新策略 → no phase0 unsupported slot', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode()],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).not.toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.2 scope !== "subStrategy" → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ scope: 'portfolio' as SemanticOrchestrationNode['scope'] })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.3 invalid mode → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ mode: 'unknown' as SemanticOrchestrationNode['mode'] })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.4 notionalCapPct=0 (≤0) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ notionalCapPct: 0 })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.5 notionalCapPct=150 (>100) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ notionalCapPct: 150 })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.6 invalid effectWhenTriggered (reduce_exposure not valid for subStrategy) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ effectWhenTriggered: 'reduce_exposure' })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.7 boundSubStrategyScopeRef empty → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode({ boundSubStrategyScopeRef: '' })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.8 boundSubStrategyScopeRef not matching any sibling scope.subStrategy id → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode('different-id'), subStrategyCapNode({ boundSubStrategyScopeRef: 'nonexistent-scope-id' })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.9 sibling scope.subStrategy exists but status=open (not locked) → phase0 unsupported', () => {
      const unlockedScope = { ...subStrategyScopeNode(), status: 'open' as const }
      const state = createSemanticState({
        orchestration: {
          nodes: [unlockedScope, subStrategyCapNode()],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })

    it('B.10 老策略 (deployedAtSemanticVersion=null) → phase0 unsupported（version-gate fail-closed）', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode()],
          contracts: [],
        },
      })
      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = readiness().normalize(state, legacy)
      const slots = result.state.orchestration?.nodes
        .find(n => n.key === 'portfolioRisk.substrategy_exposure_cap')?.openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({ slotKey: 'orchestration.phase0.unsupported' }))
    })
  })

  // ============================================================
  // Section C — Display does not leak internal keys (W2)
  // ============================================================
  describe('Section C: display projection invariants', () => {
    const projection = new SemanticStateProjectionService()

    it('C.1 supported substrategy_exposure_cap renders 中文 label without leaking internal keys', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode()],
          contracts: [],
        },
      })
      const graph = projection.buildDisplayLogicGraph(state)
      const orchestrationBlocks = graph.blocks.filter(b => b.type === 'ORCHESTRATION')
      expect(orchestrationBlocks).toHaveLength(1)

      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      // Should contain cap percentage
      expect(flat).toContain('40')
      // Must not leak internal keys
      expect(flat).not.toContain('portfolioRisk.substrategy_exposure_cap')
      expect(flat).not.toContain('orchestration.')
      expect(flat).not.toContain('substrategy_exposure_cap')
      expect(flat).not.toContain('pause_substrategy')
      expect(flat).not.toContain('block_new_entries')
    })

    it('C.2 W2: 无 orchestration nodes → display 无 ORCHESTRATION block', () => {
      const state = createSemanticState({
        normalizationNotes: ['子策略敞口不超过 40%'],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      expect(graph.blocks.filter(b => b.type === 'ORCHESTRATION')).toHaveLength(0)
    })

    it('C.3 observe mode renders distinct token from enforce mode (no "enforce" text leak)', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode(),
            subStrategyCapNode({ mode: 'observe', params: { notionalCapPct: 40, mode: 'observe' } }),
          ],
          contracts: [],
        },
      })
      const graph = projection.buildDisplayLogicGraph(state)
      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      expect(flat).not.toContain('enforce')
      expect(flat).not.toContain('pause_substrategy')
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
        orchestration: {
          nodes: [subStrategyScopeNode(), subStrategyCapNode(nodeOverrides)],
          contracts: [],
        },
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

    it('D.1 spec.orchestration.portfolioRisks 1 条 subStrategy scope + IR 透传正确', () => {
      const { spec, ir } = buildPipeline()
      const specRisks = spec.orchestration?.portfolioRisks ?? []
      expect(specRisks).toHaveLength(1)
      expect(specRisks[0]).toEqual(expect.objectContaining({
        scope: 'subStrategy',
        mode: 'enforce',
        notionalCapPct: 40,
        effectWhenTriggered: 'pause_substrategy',
      }))

      const irRisks = ir.orchestrationPortfolioRisks ?? []
      expect(irRisks).toHaveLength(1)
      expect(irRisks[0]).toEqual(expect.objectContaining({
        scope: 'subStrategy',
        mode: 'enforce',
        notionalCapPct: 40,
        effectWhenTriggered: 'pause_substrategy',
      }))
      expect(typeof irRisks[0].id).toBe('string')
      expect((irRisks[0] as { subStrategyScopeRef?: string }).subStrategyScopeRef).toBe(SUBSTRATEGY_SCOPE_ID)
    })

    it('D.2 evaluator: enforce + ratio=50% > cap=40% + pause_substrategy → pausedSubStrategyScopeRefs', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE_ID]: 5000 },
        accountEquity: 10000,
      })
      expect(result.blockEntryLong).toBe(false) // scoped, not global
      expect(result.blockEntryShort).toBe(false)
      const paused = result.pausedSubStrategyScopeRefs
      expect(paused?.has(SUBSTRATEGY_SCOPE_ID)).toBe(true)
      expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    })

    it('D.3 evaluator: enforce + ratio=30% < cap=40% → no pause/block', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE_ID]: 3000 },
        accountEquity: 10000,
      })
      expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
      expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
      expect(result.observedBreaches).toEqual([])
    })

    it('D.4 evaluator: enforce + block_new_entries effect → blockedSubStrategyScopeRefs', () => {
      const { ir } = buildPipeline({ effectWhenTriggered: 'block_new_entries' })
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE_ID]: 5000 },
        accountEquity: 10000,
      })
      expect(result.blockedSubStrategyScopeRefs?.has(SUBSTRATEGY_SCOPE_ID)).toBe(true)
      expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    })

    it('D.5 evaluator: observe + ratio > cap → observedBreaches only (no pause/block)', () => {
      const { ir } = buildPipeline({
        mode: 'observe',
        params: { notionalCapPct: 40, mode: 'observe' },
      })
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect(risks[0].mode).toBe('observe')
      const result = evaluateOrchestrationPortfolioRisks(risks, {
        exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE_ID]: 5000 },
        accountEquity: 10000,
      })
      expect(result.blockEntryLong).toBe(false)
      expect(result.blockEntryShort).toBe(false)
      expect(result.observedBreaches).toContain(risks[0].id)
      expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
      expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    })
  })

  // ============================================================
  // Section E — Old strategy (drawdown_block only) regression
  // ============================================================
  describe('Section E: old strategy (drawdown_block only) regression', () => {
    it('E.1 drawdown-only spec: substrategy_exposure_cap absent → evaluator unchanged', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()

      const drawdownNode: SemanticOrchestrationNode = {
        id: 'orchestration-portfolio-risk-drawdown-1',
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
        status: 'locked',
        source: 'user_explicit',
        params: { thresholdPct: 15, mode: 'enforce' },
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 15,
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
        orchestration: { nodes: [drawdownNode], contracts: [] },
      })

      const spec = builder.buildFromSemanticState(state)
      const ir = compiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance' as const, symbol: 'BTCUSDT', baseTimeframe: '1m', positionPct: 10 },
      }).ir

      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect(risks).toHaveLength(1)
      expect(risks[0].scope).toBe('portfolio')
      expect(risks.find(r => r.scope === 'subStrategy')).toBeUndefined()

      const evalResult = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: 20 })
      expect(evalResult.blockEntryLong).toBe(true)
      expect(evalResult.blockEntryShort).toBe(true)
      expect(evalResult.pausedSubStrategyScopeRefs).toBeUndefined()
      expect(evalResult.blockedSubStrategyScopeRefs).toBeUndefined()
    })

    it('E.2 substrategy_exposure_cap pause 仅拦截 entry；exit phase 不受影响', () => {
      type Programs = Parameters<typeof runDecisionPrograms>[1]
      type Ctx = Parameters<typeof runDecisionPrograms>[0]
      type Guard = Parameters<typeof runDecisionPrograms>[3]

      const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

      const CLOSE_LONG_PROGRAM = {
        id: 'program_close_long',
        phase: 'exit' as const,
        priority: 100,
        when: 'predicate_close_long',
        actions: [{ kind: 'CLOSE_LONG' as const, quantity: { mode: 'position_pct' as const, value: 100 } }],
      }

      const SUBSTRATEGY_RISK: CompiledOrchestrationPortfolioRisk = {
        id: 'risk-sub-1',
        scope: 'subStrategy',
        mode: 'enforce',
        notionalCapPct: 40,
        subStrategyScopeRef: SUBSTRATEGY_SCOPE_ID,
        effectWhenTriggered: 'pause_substrategy',
      }

      const ctx = {
        position: { qty: 1 },
        currentPrice: 100,
        accountEquity: 10000,
        __compiledDecisionState: { previousPositionQty: 1, lastTriggeredByProgram: {}, barIndex: 0 },
        semanticRuntimeState: {},
      } as unknown as Ctx

      const exprValues = { predicate_close_long: true }
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks([SUBSTRATEGY_RISK], {
        exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE_ID]: 5000 },
        accountEquity: 10000,
      })
      expect(portfolioRiskState.pausedSubStrategyScopeRefs?.has(SUBSTRATEGY_SCOPE_ID)).toBe(true)

      const decision = runDecisionPrograms(
        ctx,
        [CLOSE_LONG_PROGRAM] as unknown as Programs,
        exprValues as never,
        baseGuard,
        [CLOSE_LONG_PROGRAM.id],
        undefined,
        portfolioRiskState,
      )

      // Exit programs are not blocked by scoped substrategy exposure cap
      expect(decision.action).toBe('CLOSE_LONG')
    })
  })
})
