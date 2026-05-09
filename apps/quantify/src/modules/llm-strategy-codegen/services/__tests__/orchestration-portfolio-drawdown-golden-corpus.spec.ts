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
 * Phase 5 S7 Task 16 — portfolioRisk.drawdown_block golden corpus.
 *
 * 5 段集成 spec（与 S1 gate.regime corpus 对称）：
 *   A. NL → frame → patch → state pipeline
 *   B. Readiness 7 fail-closed branches（含老策略 fail-closed）
 *   C. Display 不泄漏内部 key（含 W2 缺 state node 不渲染）
 *   D. Canonical → IR → evaluator 全链路（含 enforce vs observe undefined 分岔）
 *   E. W5 已有空仓 + drawdown 触发 → CLOSE_SHORT 仍正常
 *
 * 注：B/D 段直接构造 SemanticState，避免依赖完整 NL pipeline；
 * 只有 A 段验证 NL pipeline 端到端贯通。
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

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
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  }
}

function portfolioDrawdownNode(
  overrides: Partial<SemanticOrchestrationNode> = {},
): SemanticOrchestrationNode {
  return {
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
    ...overrides,
  }
}

describe('orchestration portfolioRisk.drawdown_block — golden corpus (Phase 5 S7 Task 16)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline
  // ============================================================
  describe('Section A: NL pipeline', () => {
    it('parses 账户回撤超过 10% 停止开新仓 into a locked portfolioRisk.drawdown_block node', () => {
      const gateway = new NaturalLanguageGatewayService()
      const normalizer = new SemanticFrameNormalizerService()
      const builder = new SemanticSeedStateBuilderService()

      const frames = gateway.parse('账户回撤超过 10% 停止开新仓')
      const drawdownFrames = frames.filter(f => f.kind === 'portfolio_drawdown')
      expect(drawdownFrames).toHaveLength(1)
      const frame = drawdownFrames[0]
      if (frame.kind === 'portfolio_drawdown') {
        expect(frame.thresholdPct).toBe(10)
        expect(frame.mode).toBe('enforce')
      }

      const patch = normalizer.normalize(frames)
      const node = patch.orchestration?.nodes[0]
      expect(node).toBeDefined()
      expect(node).toEqual(expect.objectContaining({
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
      }))
      if (node?.kind === 'portfolioRisk') {
        expect(node.mode).toBe('enforce')
        expect(node.thresholdPct).toBe(10)
        expect(node.scope).toBe('portfolio')
      }

      const state = builder.build(patch)
      expect(state).not.toBeNull()
      const stateNode = state!.orchestration?.nodes[0]
      expect(stateNode).toBeDefined()
      expect(stateNode?.kind).toBe('portfolioRisk')
      expect(stateNode?.key).toBe('portfolioRisk.drawdown_block')
      expect(stateNode?.mode).toBe('enforce')
      expect(stateNode?.thresholdPct).toBe(10)
      expect(stateNode?.scope).toBe('portfolio')
      expect(stateNode?.status).toBe('locked')
    })
  })

  // ============================================================
  // Section B — Readiness fail-closed branches
  // ============================================================
  describe('Section B: readiness fail-closed branches', () => {
    const readiness = () => new SemanticContractReadinessService()

    it('B.1 portfolioRisk.drawdown_block + enforce + thresholdPct=10 + scope=portfolio + 新策略 → 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: { nodes: [portfolioDrawdownNode()], contracts: [] },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.2 missing thresholdPct → registry openSlot orchestration.portfolio_drawdown.threshold_pct', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({ thresholdPct: undefined })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.portfolio_drawdown.threshold_pct',
      }))
      expect(slots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.3 unknown key (kind=portfolioRisk + key=portfolioRisk.unknown) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({ key: 'portfolioRisk.unknown' })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.4 scope !== portfolio → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({
            scope: 'symbol' as unknown as SemanticOrchestrationNode['scope'],
          })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.5 invalid mode → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({
            mode: 'unknown' as unknown as SemanticOrchestrationNode['mode'],
          })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.6a thresholdPct=0 (≤0) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({ thresholdPct: 0 })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.6b thresholdPct=150 (>100) → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode({ thresholdPct: 150 })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.7 老策略 (deployedAtSemanticVersion=null) → phase0 unsupported（双 fail-closed）', () => {
      const state = createSemanticState({
        orchestration: { nodes: [portfolioDrawdownNode()], contracts: [] },
      })
      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      const result = readiness().normalize(state, legacy)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })
  })

  // ============================================================
  // Section C — Display does not leak internal keys (W2)
  // ============================================================
  describe('Section C: display projection invariants', () => {
    const projection = new SemanticStateProjectionService()

    it('C.1 supported portfolioRisk.drawdown_block renders 中文 label without leaking internal keys', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [portfolioDrawdownNode()],
          contracts: [],
        },
      })

      const graph = projection.buildDisplayLogicGraph(state)
      const orchestrationBlocks = graph.blocks.filter(b => b.type === 'ORCHESTRATION')
      expect(orchestrationBlocks).toHaveLength(1)

      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      // 中文 label：当前 presentation 渲染为「账户回撤超过 10% 时阻止开新仓」
      expect(flat).toContain('账户回撤')
      expect(flat).toContain('10')
      expect(flat).toContain('阻止')
      expect(flat).not.toContain('portfolioRisk.drawdown_block')
      expect(flat).not.toContain('orchestration.')
      expect(flat).not.toContain('block_new_entries')
      expect(flat).not.toContain('drawdown_block')
      expect(flat).not.toContain('enforce')
      expect(flat).not.toContain('observe')
    })

    it('C.2 W2: 无 orchestration nodes → display 无 ORCHESTRATION block', () => {
      const state = createSemanticState({
        normalizationNotes: ['账户回撤超过 10% 停止开新仓'],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      expect(graph.blocks.filter(b => b.type === 'ORCHESTRATION')).toHaveLength(0)
    })
  })

  // ============================================================
  // Section D — Canonical → IR → evaluator
  // ============================================================
  describe('Section D: canonical → IR → evaluator', () => {
    function buildPipeline(
      nodeOverrides: Partial<SemanticOrchestrationNode> = {},
    ) {
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
          nodes: [portfolioDrawdownNode(nodeOverrides)],
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

    it('D.1 spec.orchestration.portfolioRisks 与 ir.orchestrationPortfolioRisks 各 1 条 + 形态正确', () => {
      const { spec, ir } = buildPipeline()
      expect(spec.orchestration?.portfolioRisks).toHaveLength(1)
      const risks = ir.orchestrationPortfolioRisks ?? []
      expect(risks).toHaveLength(1)
      expect(risks[0]).toEqual(expect.objectContaining({
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
        effectWhenTriggered: 'block_new_entries',
      }))
      expect(typeof risks[0].id).toBe('string')
      expect(risks[0].id.length).toBeGreaterThan(0)
    })

    it('D.2 evaluator: drawdownPct=12 + threshold=10 + enforce → blockEntryLong/Short=true', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: 12 })
      expect(result.blockEntryLong).toBe(true)
      expect(result.blockEntryShort).toBe(true)
      expect(result.observedBreaches).toEqual([])
    })

    it('D.3 evaluator: drawdownPct=undefined + enforce → fail-closed double block', () => {
      const { ir } = buildPipeline()
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      const result = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: undefined })
      expect(result.blockEntryLong).toBe(true)
      expect(result.blockEntryShort).toBe(true)
      expect(result.observedBreaches).toEqual([])
    })

    it('D.4 evaluator: drawdownPct=undefined + observe → no block + observedBreaches=[]', () => {
      const { ir } = buildPipeline({
        mode: 'observe',
        params: { thresholdPct: 10, mode: 'observe' },
      })
      const risks = (ir.orchestrationPortfolioRisks ?? []) as CompiledOrchestrationPortfolioRisk[]
      expect(risks[0].mode).toBe('observe')
      const result = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: undefined })
      expect(result.blockEntryLong).toBe(false)
      expect(result.blockEntryShort).toBe(false)
      expect(result.observedBreaches).toEqual([])
    })
  })

  // ============================================================
  // Section E — W5: existing short + drawdown 触发 → CLOSE_SHORT
  // ============================================================
  describe('Section E: W5 existing short + drawdown 触发 → CLOSE_SHORT', () => {
    it('E.1 portfolioRisk enforce 仅拦截 OPEN_*；CLOSE_SHORT 不受影响', () => {
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

      const PORTFOLIO_RISK: CompiledOrchestrationPortfolioRisk = {
        id: 'risk-portfolio-1',
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
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
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks([PORTFOLIO_RISK], { drawdownPct: 12 })
      expect(portfolioRiskState.blockEntryLong).toBe(true)
      expect(portfolioRiskState.blockEntryShort).toBe(true)

      const decision = runDecisionPrograms(
        ctx,
        [CLOSE_SHORT_PROGRAM] as unknown as Programs,
        exprValues as never,
        baseGuard,
        [CLOSE_SHORT_PROGRAM.id],
        undefined,
        portfolioRiskState,
      )

      expect(decision.action).toBe('CLOSE_SHORT')
    })
  })
})
