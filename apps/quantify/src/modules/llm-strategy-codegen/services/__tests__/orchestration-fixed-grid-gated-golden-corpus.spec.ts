import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

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
 * Phase 5 S4 Task 15 — program.fixed_grid_gated golden corpus.
 *
 * 5 段集成 spec（与 S1 / S7 corpus 同模式）：
 *   A. NL → frame → patch → state pipeline
 *   B. Readiness 8 fail-closed branches
 *   C. Display 不泄漏内部 key（含 W2 缺 state node 不渲染）
 *   D. Canonical → IR → runtime program lifecycle (orphan ref drop + 三 onDeactivate)
 *   E. W5 不变量 A/B/C：OPEN_LONG 不被改写 / NOOP+持仓合成 CLOSE / CLOSE 不重复合成
 *
 * 注：B/C/D/E 直接构造 SemanticState/IR/orderState，避免依赖完整 NL pipeline；
 *     仅 A 段验证 NL → state-builder 端到端贯通。
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

const IR_FALLBACK = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  positionPct: 10,
}

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
    id: 'orchestration-gate-regime-1',
    kind: 'gate',
    key: 'gate.regime',
    status: 'locked',
    source: 'user_explicit',
    params: { sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' },
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

function fixedGridGatedNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'orchestration-program-fixed-grid-gated-1',
    kind: 'program',
    key: 'program.fixed_grid_gated',
    status: 'locked',
    source: 'user_explicit',
    params: {
      anchorPrice: 55000,
      levelCount: 10,
      stepPct: 5,
      lowerBound: 50000,
      upperBound: 60000,
      onDeactivate: 'cancel',
      sizing: { mode: 'fixed_pct', value: 5 },
    },
    programKind: 'fixed_grid_gated',
    activeWhenRef: 'orchestration-gate-regime-1',
    onDeactivate: 'cancel',
    rebuildPolicy: 'static',
    gridParams: { anchorPrice: 55000, levelCount: 10, stepPct: 5, lowerBound: 50000, upperBound: 60000 },
    sizing: { mode: 'fixed_pct', value: 5 },
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration program.fixed_grid_gated — golden corpus (Phase 5 S4 Task 15)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline
  // ============================================================
  describe('Section A: NL pipeline', () => {
    it('A.1 parses range form + gate ref into program node, builds state', () => {
      const gateway = new NaturalLanguageGatewayService()
      const normalizer = new SemanticFrameNormalizerService()
      const builder = new SemanticSeedStateBuilderService()

      const input = 'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用，失活时撤单。价格高于 EMA50 才允许做多。'
      const frames = gateway.parse(input)
      const programFrames = frames.filter(f => f.kind === 'fixed_grid_gated')
      const gateFrames = frames.filter(f => f.kind === 'regime_gate')
      expect(programFrames).toHaveLength(1)
      expect(gateFrames.length).toBeGreaterThanOrEqual(1)

      const patch = normalizer.normalize(frames)
      const programNode = patch.orchestration?.nodes.find(n => n.kind === 'program')
      expect(programNode).toBeDefined()
      if (programNode?.kind === 'program') {
        expect(programNode.key).toBe('program.fixed_grid_gated')
        expect(programNode.gridParams.lowerBound).toBe(50000)
        expect(programNode.gridParams.upperBound).toBe(60000)
        expect(programNode.gridParams.levelCount).toBe(10)
        expect(programNode.gridParams.stepPct).toBe(5)
        expect(programNode.onDeactivate).toBe('cancel')
        expect(programNode.activeWhenRef).toBe('orchestration-gate-regime-1')
      }

      const state = builder.build(patch)
      expect(state).not.toBeNull()
      expect(state!.orchestration).toBeDefined()
      const programStateNode = state!.orchestration!.nodes.find(n => n.kind === 'program')
      expect(programStateNode).toBeDefined()
      expect(programStateNode?.key).toBe('program.fixed_grid_gated')
    })

    it('A.2 idempotent: applying same patch twice yields same orchestration node count', () => {
      const builder = new SemanticSeedStateBuilderService()
      const patch = {
        orchestration: {
          nodes: [{
            kind: 'program' as const,
            key: 'program.fixed_grid_gated' as const,
            params: {} as Record<string, unknown>,
            programKind: 'fixed_grid_gated' as const,
            activeWhenRef: 'orchestration-gate-regime-1',
            onDeactivate: 'cancel' as const,
            rebuildPolicy: 'static' as const,
            gridParams: { anchorPrice: 55000, levelCount: 10, stepPct: 5 },
            sizing: { mode: 'fixed_pct' as const, value: 5 },
          }],
        },
      }
      const s1 = builder.build(patch)
      const s2 = builder.build(patch)
      expect(s1!.orchestration!.nodes).toHaveLength(1)
      expect(s2!.orchestration!.nodes).toHaveLength(1)
    })
  })

  // ============================================================
  // Section B — Readiness fail-closed branches
  // ============================================================
  describe('Section B: readiness fail-closed branches', () => {
    const readiness = () => new SemanticContractReadinessService()
    const baseSiblings = [regimeGateNode()]

    function expectPhase0(node: SemanticOrchestrationNode, version = CURRENT_VERSION): boolean {
      const state = createSemanticState({
        orchestration: { nodes: [...baseSiblings, node], contracts: [] },
      })
      const result = readiness().normalize(state, version)
      const programNode = result.state.orchestration?.nodes.find(n => n.kind === 'program')
      const slots = programNode?.openSlots ?? []
      return slots.some(s => s.slotKey === 'orchestration.phase0.unsupported')
    }

    it('B.1 valid program + valid gate ref + new strategy → no phase0 slot', () => {
      const state = createSemanticState({
        orchestration: { nodes: [...baseSiblings, fixedGridGatedNode()], contracts: [] },
      })
      const result = readiness().normalize(state, CURRENT_VERSION)
      const programNode = result.state.orchestration?.nodes.find(n => n.kind === 'program')
      const slots = programNode?.openSlots ?? []
      expect(slots).not.toContainEqual(expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
      }))
    })

    it('B.2 missing programKind → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({ programKind: undefined }))).toBe(true)
    })

    it('B.3 invalid onDeactivate → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({
        onDeactivate: 'unknown' as unknown as SemanticOrchestrationNode['onDeactivate'],
      }))).toBe(true)
    })

    it('B.4 rebuildPolicy !== static → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({
        rebuildPolicy: 'dynamic' as unknown as SemanticOrchestrationNode['rebuildPolicy'],
      }))).toBe(true)
    })

    it('B.5 gridParams.anchorPrice ≤ 0 → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({
        gridParams: { anchorPrice: 0, levelCount: 10, stepPct: 5 },
      }))).toBe(true)
    })

    it('B.6 sizing.value ≤ 0 → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({
        sizing: { mode: 'fixed_pct', value: 0 },
      }))).toBe(true)
    })

    it('B.7 activeWhenRef references non-existent gate → phase0 unsupported', () => {
      expect(expectPhase0(fixedGridGatedNode({
        activeWhenRef: 'non-existent-gate-id',
      }))).toBe(true)
    })

    it('B.8 legacy strategy (deployedAtSemanticVersion=null) → phase0 unsupported (双 fail-closed)', () => {
      const legacy: StrategyVersionInfo = { deployedAtSemanticVersion: null }
      expect(expectPhase0(fixedGridGatedNode(), legacy)).toBe(true)
    })
  })

  // ============================================================
  // Section C — Display does not leak internal keys
  // ============================================================
  describe('Section C: display 不污染 deploy truth', () => {
    it('C.1 supported program → display 含 publicName 与数值，不含 internal key', () => {
      const projection = new SemanticStateProjectionService()
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode(), fixedGridGatedNode()], contracts: [] },
      })
      const display = projection.buildDisplayLogicGraph(state)
      const json = JSON.stringify(display)
      // publicName + 数值 + 失活语义文案
      expect(json).toMatch(/门控固定网格|区间网格|门控网格/)
      // 数值
      expect(json).toContain('50000')
      expect(json).toContain('5')
      // 失活语义中文（撤单），不含 internal mode literal
      expect(json).toContain('撤单')
      // internal keys 不能泄漏
      expect(json).not.toContain('program.fixed_grid_gated')
      expect(json).not.toMatch(/orchestration\./u)
      expect(json).not.toMatch(/(?:^|[^a-z])cancel(?=[^a-z]|$)/u)
      expect(json).not.toMatch(/(?:^|[^a-z])keep(?=[^a-z]|$)/u)
      expect(json).not.toMatch(/(?:^|[^a-z])close(?=[^a-z]|$)/u)
    })

    it('C.2 W2: no orchestration.nodes → display 不渲染 program', () => {
      const projection = new SemanticStateProjectionService()
      const state = createSemanticState({})
      const display = projection.buildDisplayLogicGraph(state)
      const json = JSON.stringify(display)
      expect(json).not.toContain('门控固定网格')
      expect(json).not.toContain('program.fixed_grid_gated')
    })
  })

  // ============================================================
  // Section D — Canonical → IR → runtime
  // ============================================================
  describe('Section D: canonical → IR → runtime', () => {
    it('D.1 state → canonical spec.orchestration.programs.length === 1', () => {
      const builder = new CanonicalSpecBuilderService()
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode(), fixedGridGatedNode()], contracts: [] },
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec?.orchestration?.programs ?? []).toHaveLength(1)
      const program = spec?.orchestration?.programs?.[0]
      expect(program?.activeWhenRef).toBe('orchestration-gate-regime-1')
      expect(program?.onDeactivate).toBe('cancel')
      expect(program?.rebuildPolicy).toBe('static')
    })

    it('D.2 IR.orchestrationPrograms.length === 1，activeWhenExprId 解引用为 gate exprId', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()
      const state = createSemanticState({
        orchestration: { nodes: [regimeGateNode(), fixedGridGatedNode()], contracts: [] },
      })
      const spec = builder.buildFromSemanticState(state)!
      const { ir } = compiler.compile({ canonicalSpec: spec, fallback: IR_FALLBACK })
      expect(ir.orchestrationPrograms ?? []).toHaveLength(1)
      const program = ir.orchestrationPrograms![0]
      const gate = ir.orchestrationGates?.find(g => g.id === 'orchestration-gate-regime-1')
      expect(gate).toBeDefined()
      expect(program.activeWhenExprId).toBe(gate!.exprId)
    })

    it('D.3 orphan activeWhenRef → IR drops program', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()
      const state = createSemanticState({
        orchestration: {
          nodes: [
            // gate id intentionally NOT 'orchestration-gate-regime-1'
            regimeGateNode({ id: 'orchestration-gate-regime-other' }),
            fixedGridGatedNode({ activeWhenRef: 'non-existent-gate' }),
          ],
          contracts: [],
        },
      })
      const spec = builder.buildFromSemanticState(state)!
      const { ir } = compiler.compile({ canonicalSpec: spec, fallback: IR_FALLBACK })
      // canonical 仍然 emit (canonical 阶段不做 cross-ref)，IR 阶段丢弃 orphan
      expect(ir.orchestrationPrograms ?? []).toHaveLength(0)
    })

    it('D.4 runOrderPrograms with active=true → workingOrders levels 由 anchor/step/levelCount 生成', () => {
      const result = runOrderPrograms(
        { currentBar: {} } as unknown as Parameters<typeof runOrderPrograms>[0],
        [],
        { 'expr-1': true } as unknown as Parameters<typeof runOrderPrograms>[2],
        { forceExit: false } as unknown as Parameters<typeof runOrderPrograms>[3],
        [],
        undefined,
        [{
          id: 'p1',
          programKind: 'fixed_grid_gated',
          activeWhenExprId: 'expr-1',
          onDeactivate: 'cancel',
          rebuildPolicy: 'static',
          gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
          sizing: { mode: 'fixed_pct', value: 5 },
        }],
      )
      const program = result.workingOrders.find(o => o.id === 'p1')
      expect(program).toBeDefined()
      expect(program?.levels?.length).toBeGreaterThan(0)
      expect(result.cancelledProgramIds).not.toContain('p1')
      expect(result.closeProgramIds).not.toContain('p1')
    })

    it('D.5 onDeactivate 三模式：cancel / keep / close', () => {
      const baseProgram = {
        id: 'p1',
        programKind: 'fixed_grid_gated' as const,
        activeWhenExprId: 'expr-1',
        rebuildPolicy: 'static' as const,
        gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
        sizing: { mode: 'fixed_pct' as const, value: 5 },
      }
      const exprValues = { 'expr-1': false } as unknown as Parameters<typeof runOrderPrograms>[2]
      const args = (onDeactivate: 'cancel' | 'keep' | 'close') => [
        { currentBar: {} } as unknown as Parameters<typeof runOrderPrograms>[0],
        [] as Parameters<typeof runOrderPrograms>[1],
        exprValues,
        { forceExit: false } as unknown as Parameters<typeof runOrderPrograms>[3],
        [] as readonly string[],
        undefined,
        [{ ...baseProgram, onDeactivate }] as Parameters<typeof runOrderPrograms>[6],
      ] as const

      const cancelResult = runOrderPrograms(...args('cancel'))
      expect(cancelResult.cancelledProgramIds).toContain('p1')
      expect(cancelResult.workingOrders.some(o => o.id === 'p1')).toBe(false)
      expect(cancelResult.closeProgramIds).not.toContain('p1')

      const keepResult = runOrderPrograms(...args('keep'))
      expect(keepResult.workingOrders.some(o => o.id === 'p1')).toBe(true)
      expect(keepResult.cancelledProgramIds).not.toContain('p1')
      expect(keepResult.closeProgramIds).not.toContain('p1')

      const closeResult = runOrderPrograms(...args('close'))
      expect(closeResult.closeProgramIds).toContain('p1')
      expect(closeResult.workingOrders.some(o => o.id === 'p1')).toBe(false)
      expect(closeResult.cancelledProgramIds).not.toContain('p1')
    })
  })

  // ============================================================
  // Section E — W5 不变量
  // ============================================================
  describe('Section E: W5 invariant', () => {
    /**
     * W5-A/B/C 的 close-decision 合成行为由 backtest-strategy-adapter (T12)
     * synthesizeCloseDecision 完成。本 spec 在 evaluator + runOrderPrograms 层
     * 验证 closeProgramIds 的语义边界（program close 不污染 cancelledProgramIds /
     * 不污染 workingOrders）；synthesizeCloseDecision 自身的三态映射由
     * backtest-compiled-runtime-compat.spec.ts T12 cases 覆盖。
     */
    it('E.W5-A: program close + 任意持仓 → orderState.closeProgramIds 含 program；cancelledProgramIds 不含', () => {
      const orderState = runOrderPrograms(
        { currentBar: {} } as unknown as Parameters<typeof runOrderPrograms>[0],
        [],
        { 'expr-1': false } as unknown as Parameters<typeof runOrderPrograms>[2],
        { forceExit: false } as unknown as Parameters<typeof runOrderPrograms>[3],
        [],
        undefined,
        [{
          id: 'p1',
          programKind: 'fixed_grid_gated',
          activeWhenExprId: 'expr-1',
          onDeactivate: 'close',
          rebuildPolicy: 'static',
          gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
          sizing: { mode: 'fixed_pct', value: 5 },
        }],
      )
      expect(orderState.closeProgramIds).toContain('p1')
      expect(orderState.cancelledProgramIds).not.toContain('p1')
      expect(orderState.workingOrders.some(o => o.id === 'p1')).toBe(false)
    })

    it('E.W5-B: closeProgramIds 与 cancelledProgramIds 独立旁路（OPEN_* 时不影响 decision，由 adapter 决定 — 此处仅验 evaluator 不互染）', () => {
      const orderState = runOrderPrograms(
        { currentBar: {} } as unknown as Parameters<typeof runOrderPrograms>[0],
        [],
        { 'expr-1': false, 'expr-2': false } as unknown as Parameters<typeof runOrderPrograms>[2],
        { forceExit: false } as unknown as Parameters<typeof runOrderPrograms>[3],
        [],
        undefined,
        [
          {
            id: 'p1',
            programKind: 'fixed_grid_gated',
            activeWhenExprId: 'expr-1',
            onDeactivate: 'close',
            rebuildPolicy: 'static',
            gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
            sizing: { mode: 'fixed_pct', value: 5 },
          },
          {
            id: 'p2',
            programKind: 'fixed_grid_gated',
            activeWhenExprId: 'expr-2',
            onDeactivate: 'cancel',
            rebuildPolicy: 'static',
            gridParams: { anchorPrice: 60000, levelCount: 3, stepPct: 5 },
            sizing: { mode: 'fixed_pct', value: 5 },
          },
        ],
      )
      expect(orderState.closeProgramIds).toContain('p1')
      expect(orderState.closeProgramIds).not.toContain('p2')
      expect(orderState.cancelledProgramIds).toContain('p2')
      expect(orderState.cancelledProgramIds).not.toContain('p1')
    })

    it('E.W5-C: gateState block + portfolioRiskState undefined + program close 三态正交（runDecisionPrograms 不触发任何合成）', () => {
      const decision = runDecisionPrograms(
        {
          __compiledDecisionState: { barIndex: 0 },
          currentBar: { close: 50000 },
          currentPositionQty: 0,
        } as unknown as Parameters<typeof runDecisionPrograms>[0],
        [],
        { 'expr-gate': false } as unknown as Parameters<typeof runDecisionPrograms>[2],
        { forceExit: false } as unknown as Parameters<typeof runDecisionPrograms>[3],
        [],
        evaluateOrchestrationGates(
          [{
            id: 'g1',
            exprId: 'expr-gate',
            target: { phase: 'entry', sideScope: 'long' },
            effectWhenFalse: 'block_new_entries',
          }],
          { 'expr-gate': false } as unknown as Parameters<typeof evaluateOrchestrationGates>[1],
        ),
        undefined,
      )
      // decision 与 program close 正交：runDecisionPrograms 不读 closeProgramIds，
      // close 信号合成由 adapter 层 (T12) 完成
      expect(decision.action).toBe('NOOP')
    })
  })
})
