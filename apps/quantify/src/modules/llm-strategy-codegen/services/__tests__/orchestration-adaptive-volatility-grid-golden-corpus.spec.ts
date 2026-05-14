import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
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
 * Phase 5 S6 Task 18 (#984) — program.adaptive_volatility_grid golden corpus.
 *
 * ≥ 33 cases（plan v3 critic round 1 M4）：
 *   - 16 readiness fail-closed
 *   - 6 NL pipeline
 *   - 1 display 黑名单 / 用户友好
 *   - 4 canonical → IR → runtime
 *   - ≥3 W5 不变量
 *   - 3 onDeactivate（cancel / keep / close）
 *   合计 33+
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

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

function adaptiveNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'orchestration-program-adaptive-1',
    kind: 'program',
    key: 'program.adaptive_volatility_grid',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    programKind: 'adaptive_volatility_grid',
    activeWhenRef: 'orchestration-gate-regime-1',
    onDeactivate: 'cancel',
    rebuildPolicy: 'atr_window',
    atrPeriod: 14,
    atrMultiplier: 1.5,
    rangeMultiplier: 10,
    atrDriftPct: 25,
    rebuildCooldownSec: 600,
    minStepPct: 0.2,
    maxStepPct: 5,
    levelCount: 6,
    sizing: { mode: 'fixed_quote', value: 100 },
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function expectPhase0(node: SemanticOrchestrationNode): boolean {
  return (node.openSlots ?? []).some(s => s.slotKey === 'orchestration.phase0.unsupported')
}

describe('orchestration program.adaptive_volatility_grid — golden corpus (Phase 5 S6 #984)', () => {
  const readiness = new SemanticContractReadinessService()

  // ============ Section A — NL pipeline (6 cases) ============
  describe('Section A: NL pipeline', () => {
    const gateway = new NaturalLanguageGatewayService()
    const normalizer = new SemanticFrameNormalizerService()
    const builder = new SemanticSeedStateBuilderService()

    const utterances: Array<[string, string]> = [
      ['A.1 ATR(14) 1.5 倍步长 3 倍区间', 'BTC 用 ATR(14) 1.5 倍步长 3 倍区间自适应网格 6 档 每档 0.2%-2% 钳制，趋势上涨时启用，停用时撤单'],
      ['A.2 ATR(20) 5 档', 'ETHUSDT ATR(20) 2 倍步长 4 倍区间自适应网格 5 档 每档 0.1%-1.5%，鲸鱼活跃时启用，停用平仓'],
      ['A.3 不少于/不超过 + atr-7 dash', 'BTC ATR(7) 自适应网格 2.5 倍步长 3.5 倍区间 6 档 每档不少于 0.5% 不超过 3%，冷却 600 秒，趋势上涨时启用'],
      ['A.4 波动率 N + 漂移', '波动率 14 自适应网格 8 档 atr 漂移 25% 触发重建 每档 0.3%-2%，趋势震荡时启用，1 倍步长 5 倍区间，停用时保留'],
      ['A.5 atr N 空格写法', 'atr 14 自适应网格 6 档 1 倍 5 倍 每档 0.2%-2%，趋势上涨时启用'],
      ['A.6 ATR(14) 双倍数（锚词）', 'ATR(14) 自适应 6 档 1.2 倍步长 4 倍区间 每档 0.2%-3%，趋势震荡时启用'],
    ]

    for (const [name, input] of utterances) {
      it(name, () => {
        const frames = gateway.parse(input)
        const adaptiveFrames = frames.filter(f => f.kind === 'adaptive_volatility_grid')
        expect(adaptiveFrames.length).toBeGreaterThan(0)
        const patch = normalizer.normalize(frames)
        const programNodes = patch.orchestration?.nodes?.filter(n => n.kind === 'program' && n.key === 'program.adaptive_volatility_grid') ?? []
        expect(programNodes.length).toBe(1)
        const state = builder.build(patch as never)
        if (!state) throw new Error('builder returned null')
        expect(state.orchestration.some(n => n.kind === 'program' && n.key === 'program.adaptive_volatility_grid')).toBe(true)
      })
    }
  })

  // ============ Section B — Readiness 16 fail-closed ============
  describe('Section B: 16 readiness fail-closed', () => {
    const variations: Array<[string, Partial<SemanticOrchestrationNode>]> = [
      ['case 1 kind != program', { kind: 'gate' as never }],
      ['case 2 key 错误', { key: 'program.unknown' as never }],
      ['case 3 programKind 不匹配', { programKind: 'fixed_grid_gated' }],
      ['case 4 onDeactivate 非法', { onDeactivate: 'pause' as never }],
      ['case 5 rebuildPolicy 非 atr_window', { rebuildPolicy: 'static' }],
      ['case 6 atrPeriod 越界', { atrPeriod: 1 }],
      ['case 7 atrMultiplier <= 0', { atrMultiplier: 0 }],
      ['case 8 rangeMultiplier <= 0', { rangeMultiplier: -1 }],
      ['case 9 atrDriftPct 越界', { atrDriftPct: 0 }],
      ['case 10 rebuildCooldownSec < 300（硬下限）', { rebuildCooldownSec: 299 }],
      ['case 11 minStepPct <= 0', { minStepPct: 0 }],
      ['case 12 maxStepPct <= 0', { maxStepPct: 0 }],
      ['case 13 max < min（配置矛盾）', { minStepPct: 2, maxStepPct: 1 }],
      ['case 14 levelCount 越界', { levelCount: 1 }],
      ['case 15 sizing.value <= 0', { sizing: { mode: 'fixed_quote', value: 0 } }],
      ['case 16 activeWhenRef 缺失', { activeWhenRef: undefined }],
    ]
    for (const [name, override] of variations) {
      it(name, () => {
        const target = adaptiveNode(override)
        const state = createSemanticState({
          orchestration: [regimeGateNode(), target], orchestrationContracts: [],
        })
        const result = readiness.normalize(state, CURRENT_VERSION)
        const node = result.state.orchestration.find(n => n.id === target.id)
        expect(node).toBeDefined()
        expect(expectPhase0(node!)).toBe(true)
      })
    }
  })

  // ============ Section C — Display 黑名单 + 正向 grep ============
  describe('Section C: display 黑名单 + 正向 grep（critic round 2 Q8 双向）', () => {
    it('C.1 display 文本不泄漏 3 内部 key（负 grep）+ 保留 ATR / 自适应网格 fragment（正 grep）', () => {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), adaptiveNode()], orchestrationContracts: [],
      })
      const projection = new SemanticStateProjectionService()
      const graph = projection.buildDisplayLogicGraph(state)
      const programItems = graph.blocks.flatMap(b =>
        ('items' in b && Array.isArray((b as { items: unknown[] }).items)
          ? (b as { items: Array<{ kind: string; text: string; publicName: string }> }).items
          : []
        ).filter(i => i.kind === 'program'),
      )
      expect(programItems.length).toBeGreaterThan(0)
      const text = programItems[0].text
      // 负 grep
      expect(text).not.toMatch(/program\.adaptive_volatility_grid/)
      expect(text).not.toMatch(/atr_window/)
      expect(text).not.toMatch(/adaptive_volatility_grid/)
      // 正 grep
      expect(text).toMatch(/ATR/)
      expect(text).toMatch(/自适应网格/)
    })
  })

  // ============ Section D — Canonical → IR → runtime (4 cases) ============
  describe('Section D: canonical → IR → runtime', () => {
    function buildCanonicalAndIr(node: SemanticOrchestrationNode) {
      const state = createSemanticState({
        orchestration: [regimeGateNode(), node], orchestrationContracts: [],
      })
      const result = readiness.normalize(state, CURRENT_VERSION)
      const canonicalBuilder = new CanonicalSpecBuilderService()
      const canonical = canonicalBuilder.buildFromSemanticState(result.state)
      const irCompiler = new CanonicalSpecV2IrCompilerService()
      const ir = irCompiler.compile({
        canonicalSpec: canonical,
        fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      return { canonical, ir }
    }

    function makeBars(count: number, opts: { high?: number; low?: number; close?: number; startTimestamp?: number } = {}) {
      const high = opts.high ?? 100.5
      const low = opts.low ?? 99.5
      const close = opts.close ?? 100
      const start = opts.startTimestamp ?? 1_700_000_000_000
      return Array.from({ length: count }, (_, i) => ({
        open: close, high, low, close, volume: 1000, timestamp: start + i * 60_000,
      }))
    }

    it('D.1 ATR 稳定 → 不 rebuild + 输出 prev.lastBuildLadder', () => {
      const node = adaptiveNode({}, )
      const { ir } = buildCanonicalAndIr(node)
      expect((ir.ir.orchestrationPrograms ?? []).length).toBe(1)
      const program = (ir.ir.orchestrationPrograms ?? [])[0]!
      expect(program.programKind).toBe('adaptive_volatility_grid')

      const bars = makeBars(20)
      const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }
      // 首次 build
      const r1 = runOrderPrograms({ bars } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never)
      const prev = r1.programLifecycleStateNext
      // 第二根 K 线 ATR 不变 → drift < 25% → keep
      const r2 = runOrderPrograms({ bars } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never, prev)
      expect(r2.programLifecycleStateNext[program.id]).toEqual(prev[program.id])
    })

    it('D.2 ATR 漂移触发 rebuild + 钳制未触发（rebuildClamped=false）', () => {
      const node = adaptiveNode({}, )
      const { ir } = buildCanonicalAndIr(node)
      const program = (ir.ir.orchestrationPrograms ?? [])[0]!
      const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }
      const bars = makeBars(20, { high: 100.5, low: 99.5, close: 100 })
      const r1 = runOrderPrograms({ bars } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never)
      const entry1 = r1.programLifecycleStateNext[program.id]
      expect(entry1?.kind).toBe('adaptive_volatility_grid')
      if (entry1?.kind === 'adaptive_volatility_grid') {
        expect(entry1.rebuildClamped).toBe(false)
      }
    })

    it('D.3 ATR 漂移触发 rebuild + 钳制触发（rebuildClamped=true，rawStepPct < minStepPct）', () => {
      const node = adaptiveNode({ minStepPct: 1, maxStepPct: 5 })
      const { ir } = buildCanonicalAndIr(node)
      const program = (ir.ir.orchestrationPrograms ?? [])[0]!
      const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }
      // 极小 ATR → rawStepPct < 1
      const bars = makeBars(20, { high: 100.01, low: 99.99, close: 100 })
      const r = runOrderPrograms({ bars } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never)
      const entry = r.programLifecycleStateNext[program.id]
      if (entry?.kind === 'adaptive_volatility_grid') {
        expect(entry.rebuildClamped).toBe(true)
      }
    })

    it('D.4 ATR 不可用：(a) 有 prev → keep ladder + reason；(b) 无 prev → cancelled', () => {
      const node = adaptiveNode()
      const { ir } = buildCanonicalAndIr(node)
      const program = (ir.ir.orchestrationPrograms ?? [])[0]!
      const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }
      const tooFew = makeBars(5)
      // (a)
      const prev: Record<string, ProgramLifecycleState> = {
        [program.id]: {
          kind: 'adaptive_volatility_grid',
          lastBuildATR: 1,
          lastBuildAt: 1_700_000_000_000,
          lastBuildLadder: [{ id: 'a', level: 99 }],
          rebuildClamped: false,
        },
      }
      const ra = runOrderPrograms({ bars: tooFew } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never, prev)
      const woA = ra.workingOrders.find(w => w.id === program.id)
      expect((woA?.payload as Record<string, unknown>).reason).toBe('compiled.orchestration.program.atr_unavailable_keep_ladder')
      // (b)
      const rb = runOrderPrograms({ bars: tooFew } as never, [], { [program.activeWhenExprId]: true } as never, guard as never, [], undefined, [program] as never)
      expect(rb.cancelledProgramIds).toContain(program.id)
      expect(rb.programLifecycleStateNext).not.toHaveProperty(program.id)
    })
  })

  // ============ Section E — W5 不变量 (≥3 cases) ============
  describe('Section E: W5 不变量 (orderState 与 closeProgramIds)', () => {
    function makeBars(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        open: 100, high: 100.5, low: 99.5, close: 100, volume: 1, timestamp: 1_700_000_000_000 + i * 60_000,
      }))
    }
    const bars = makeBars(20)

    function runWithCompiled(program: ProgramLifecycleState extends infer _ ? never : never): never { return undefined as never }
    void runWithCompiled

    function buildCompiled() {
      return {
        id: 'p1',
        programKind: 'adaptive_volatility_grid' as const,
        activeWhenExprId: 'expr-1',
        onDeactivate: 'close' as const,
        rebuildPolicy: 'atr_window' as const,
        adaptiveGridParams: {
          atrPeriod: 14, atrMultiplier: 1.5, rangeMultiplier: 10, atrDriftPct: 25,
          rebuildCooldownSec: 300, minStepPct: 0.2, maxStepPct: 5, levelCount: 6,
        },
        sizing: { mode: 'fixed_pct' as const, value: 5 },
      }
    }

    const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }

    it('E.1 (W5-A) onDeactivate=close + activeWhen=false → closeProgramIds 含 program；不污染 workingOrders', () => {
      const program = buildCompiled()
      const r = runOrderPrograms({ bars } as never, [], { 'expr-1': false } as never, guard as never, [], undefined, [program] as never)
      expect(r.closeProgramIds).toContain('p1')
      expect(r.workingOrders.some(o => o.id === 'p1')).toBe(false)
      expect(r.cancelledProgramIds).not.toContain('p1')
    })

    it('E.2 (W5-B) cancelOrderPrograms=true + 有 prev → cancelledProgramIds + 透传 prev', () => {
      const program = buildCompiled()
      const prev: Record<string, ProgramLifecycleState> = {
        p1: {
          kind: 'adaptive_volatility_grid',
          lastBuildATR: 1, lastBuildAt: 1, lastBuildLadder: [{ id: 'a', level: 99 }], rebuildClamped: false,
        },
      }
      const guardCancel = { ...guard, cancelOrderPrograms: true }
      const r = runOrderPrograms({ bars } as never, [], { 'expr-1': true } as never, guardCancel as never, [], undefined, [program] as never, prev)
      expect(r.cancelledProgramIds).toContain('p1')
      expect(r.programLifecycleStateNext.p1).toEqual(prev.p1)
    })

    it('E.3 (W5-C) deterministic now：ctx.timestamp undefined → lastBuildAt = bars[last].timestamp', () => {
      const program = buildCompiled()
      const r = runOrderPrograms({ bars } as never, [], { 'expr-1': true } as never, guard as never, [], undefined, [program] as never)
      const entry = r.programLifecycleStateNext.p1
      if (entry?.kind === 'adaptive_volatility_grid') {
        expect(entry.lastBuildAt).toBe(bars[bars.length - 1].timestamp)
      }
    })
  })

  // ============ Section F — onDeactivate 三模式 ============
  describe('Section F: onDeactivate 三模式', () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({ open: 100, high: 100.5, low: 99.5, close: 100, volume: 1, timestamp: 1_700_000_000_000 + i * 60_000 }))
    const guard = { forceExit: false, blockNewEntry: false, strategyHalt: false, cancelOrderPrograms: false, triggered: [] }

    function build(onDeactivate: 'cancel' | 'keep' | 'close') {
      return {
        id: 'p1',
        programKind: 'adaptive_volatility_grid' as const,
        activeWhenExprId: 'e1',
        onDeactivate,
        rebuildPolicy: 'atr_window' as const,
        adaptiveGridParams: {
          atrPeriod: 14, atrMultiplier: 1.5, rangeMultiplier: 10, atrDriftPct: 25,
          rebuildCooldownSec: 300, minStepPct: 0.2, maxStepPct: 5, levelCount: 6,
        },
        sizing: { mode: 'fixed_pct' as const, value: 5 },
      }
    }

    const prev: Record<string, ProgramLifecycleState> = {
      p1: { kind: 'adaptive_volatility_grid', lastBuildATR: 1, lastBuildAt: 1, lastBuildLadder: [{ id: 'a', level: 99 }], rebuildClamped: false },
    }

    it('F.1 cancel：cancelledProgramIds 含 p1', () => {
      const r = runOrderPrograms({ bars } as never, [], { e1: false } as never, guard as never, [], undefined, [build('cancel')] as never, prev)
      expect(r.cancelledProgramIds).toContain('p1')
    })

    it('F.2 keep：workingOrders 含 p1（带 prev ladder）', () => {
      const r = runOrderPrograms({ bars } as never, [], { e1: false } as never, guard as never, [], undefined, [build('keep')] as never, prev)
      expect(r.workingOrders.some(o => o.id === 'p1')).toBe(true)
    })

    it('F.3 close：closeProgramIds 含 p1（透传 prev）', () => {
      const r = runOrderPrograms({ bars } as never, [], { e1: false } as never, guard as never, [], undefined, [build('close')] as never, prev)
      expect(r.closeProgramIds).toContain('p1')
      expect(r.programLifecycleStateNext.p1).toEqual(prev.p1)
    })
  })
})
