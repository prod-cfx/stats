import type { CompiledOrchestrationGate } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
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
 * Phase 5 S1 Task 17 — gate.regime golden corpus.
 *
 * 5 段集成 spec：
 *   A. NL → frame → patch → state pipeline
 *   B. Readiness 6 fail-closed branches（含老策略 fail-closed）
 *   C. Display 不泄漏内部 key（含 W2 缺 state node 不渲染）
 *   D. Canonical → IR → evaluator 全链路
 *   E. W5 已有空仓 + gate=false → CLOSE_SHORT
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

function regimeGateNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'gate-regime-1',
    kind: 'gate',
    key: 'gate.regime',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    target: { phase: 'entry', sideScope: 'long' },
    activeWhen: {
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'indicator', name: 'ema', params: { period: 50 } },
    },
    effectWhenFalse: 'block_new_entries',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration gate.regime — golden corpus (Phase 5 S1 Task 17)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline
  // ============================================================
  describe('Section A: NL pipeline', () => {
    it('parses 价格高于 EMA50 才允许做多 into a locked gate.regime orchestration node', () => {
      const gateway = new NaturalLanguageGatewayService()
      const normalizer = new SemanticFrameNormalizerService()
      const builder = new SemanticSeedStateBuilderService()

      const frames = gateway.parse('价格高于 EMA50 才允许做多')
      expect(frames.some(f => f.kind === 'regime_gate')).toBe(true)

      const patch = normalizer.normalize(frames)
      const node = patch.orchestration?.nodes[0]
      expect(node).toBeDefined()
      expect(node).toEqual(expect.objectContaining({
        kind: 'gate',
        key: 'gate.regime',
        target: { phase: 'entry', sideScope: 'long' },
        effectWhenFalse: 'block_new_entries',
      }))
      expect(node?.activeWhen).toEqual(expect.objectContaining({ kind: 'predicate', op: 'GT' }))

      const state = builder.build(patch)
      expect(state).not.toBeNull()
      const stateNode = state!.orchestration?.nodes[0]
      expect(stateNode).toBeDefined()
      expect(stateNode?.kind).toBe('gate')
      expect(stateNode?.key).toBe('gate.regime')
      expect(stateNode?.target).toEqual({ phase: 'entry', sideScope: 'long' })
      expect(stateNode?.status).toBe('locked')
    })
  })

  // ============================================================
  // Section B — Readiness fail-closed branches
  // ============================================================
  describe('Section B: readiness fail-closed branches', () => {
    const readiness = () => new SemanticContractReadinessService()

    it('B.1 gate.regime + activeWhen valid + 新策略 → 不注入 phase0 slot', () => {
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode()], contracts: [] },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.2 gate.regime missing activeWhen → registry-driven active_when open slot', () => {
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode({ activeWhen: undefined })], contracts: [] },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.gate.regime.active_when',
      }))
      expect(slots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.3 kind=gate + key=未知 → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({ key: 'unknown_gate_atom' })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.4 gate.regime + target.phase=exit → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({ target: { phase: 'exit' as 'entry', sideScope: 'long' } })],
          contracts: [],
        },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const slots = result.state.orchestration?.nodes[0].openSlots ?? []
      expect(slots).toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.5 gate.regime + activeWhen 不是表达式对象 → phase0 unsupported', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [regimeGateNode({
            activeWhen: 'not-an-expression' as unknown as SemanticOrchestrationNode['activeWhen'],
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

    it('B.6 gate.regime valid + 老策略 (deployedAtSemanticVersion=null) → 双 fail-closed phase0', () => {
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode()], contracts: [] },
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

    it('C.1 supported gate.regime renders human label without internal keys', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [{
            id: 'orchestration-gate-regime-1',
            kind: 'gate',
            key: 'gate.regime',
            params: { sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [],
          }],
          contracts: [],
        },
      })

      const graph = projection.buildDisplayLogicGraph(state)
      const orchestrationBlocks = graph.blocks.filter(b => b.type === 'ORCHESTRATION')
      expect(orchestrationBlocks).toHaveLength(1)

      const flat = graph.blocks.flatMap(b => b.items.map(i => i.text)).join(' ')
      // 中文 label：当前 presentation 渲染为「只在价格高于 EMA50 时允许做多」
      expect(flat).toContain('EMA50')
      expect(flat).toContain('做多')
      expect(flat).toMatch(/价格\s*高于/u)
      expect(flat).not.toContain('gate.regime')
      expect(flat).not.toContain('orchestration.gate')
      expect(flat).not.toContain('activeWhen')
      expect(flat).not.toContain('block_new_entries')
    })

    it('C.2 W2: 无 orchestration nodes → display 无 ORCHESTRATION block', () => {
      const state = createSemanticState({
        normalizationNotes: ['只在 EMA50 上方才做多'],
      })
      const graph = projection.buildDisplayLogicGraph(state)
      expect(graph.blocks.filter(b => b.type === 'ORCHESTRATION')).toHaveLength(0)
    })
  })

  // ============================================================
  // Section D — Canonical → IR → evaluator
  // ============================================================
  describe('Section D: canonical → IR → evaluator', () => {
    function buildPipeline() {
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
          nodes: [{
            id: 'gate-regime-long-1',
            kind: 'gate',
            key: 'gate.regime',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [],
            params: {},
            target: { phase: 'entry', sideScope: 'long' },
            activeWhen: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
              right: { kind: 'indicator', name: 'ema', params: { length: 50 } },
            },
            effectWhenFalse: 'block_new_entries',
          }],
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

    it('D.1 spec.orchestration.gates 与 ir.orchestrationGates 各 1 条 + non-empty exprId', () => {
      const { spec, ir } = buildPipeline()
      expect(spec.orchestration?.gates).toHaveLength(1)
      const gates = ir.orchestrationGates ?? []
      expect(gates).toHaveLength(1)
      expect(typeof gates[0].exprId).toBe('string')
      expect(gates[0].exprId.length).toBeGreaterThan(0)
    })

    it('D.2 evaluator: gate=true → blockEntryLong=false', () => {
      const { ir } = buildPipeline()
      const gates = ir.orchestrationGates ?? []
      const exprId = gates[0].exprId
      const result = evaluateOrchestrationGates(gates, { [exprId]: true })
      expect(result.blockEntryLong).toBe(false)
    })

    it('D.3 evaluator: gate=false → blockEntryLong=true', () => {
      const { ir } = buildPipeline()
      const gates = ir.orchestrationGates ?? []
      const exprId = gates[0].exprId
      const result = evaluateOrchestrationGates(gates, { [exprId]: false })
      expect(result.blockEntryLong).toBe(true)
    })

    it('D.4 evaluator: missing exprValue → fail-closed (block long)', () => {
      const { ir } = buildPipeline()
      const gates = ir.orchestrationGates ?? []
      const result = evaluateOrchestrationGates(gates, {})
      expect(result.blockEntryLong).toBe(true)
    })
  })

  // ============================================================
  // Section E — W5: existing short + gate=false → CLOSE_SHORT
  // ============================================================
  describe('Section E: W5 existing short + gate=false → CLOSE_SHORT', () => {
    it('E.1 gate 仅拦截 OPEN_*；CLOSE_SHORT 不受 gate 影响', () => {
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

      const SHORT_GATE: CompiledOrchestrationGate = {
        id: 'gate-short',
        exprId: 'expr-short',
        target: { phase: 'entry', sideScope: 'short' },
        effectWhenFalse: 'block_new_entries',
      }

      const ctx = {
        position: { qty: -1 },
        currentPrice: 100,
        accountEquity: 10000,
        __compiledDecisionState: { previousPositionQty: -1, lastTriggeredByProgram: {}, barIndex: 0 },
        semanticRuntimeState: {},
      } as unknown as Ctx

      const exprValues = { 'expr-short': false, predicate_close_short: true }
      const gateState = evaluateOrchestrationGates([SHORT_GATE], exprValues as never)
      expect(gateState.blockEntryShort).toBe(true)

      const decision = runDecisionPrograms(
        ctx,
        [CLOSE_SHORT_PROGRAM] as unknown as Programs,
        exprValues as never,
        baseGuard,
        [CLOSE_SHORT_PROGRAM.id],
        gateState,
      )

      expect(decision.action).toBe('CLOSE_SHORT')
    })
  })
})
