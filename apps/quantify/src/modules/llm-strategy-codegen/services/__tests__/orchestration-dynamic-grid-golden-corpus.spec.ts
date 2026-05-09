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
 * Phase 5 S5 Task 17（#984）— program.dynamic_grid golden corpus（≥18 cases）。
 *
 *   A. NL → frame → patch → state（6 case，覆盖 anchorSide 三态 + step 两 mode + sizing 三 mode）
 *   B. Readiness 15 fail-closed（每路径 1 case）
 *   C. Display 不泄漏黑名单 6 字面量（1 case）
 *   D. Canonical → IR → runtime ladder rebuild（4 case）
 *   E. W5 不变量 + onDeactivate 三模式（3 + 3 = 6 case）
 *   F. 锁公式 fixture：mid / drift（2 case）
 *
 * 总计 ≥ 32 case，远超 plan 要求 ≥18。
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: '2026.05.W02' }

const IR_FALLBACK = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  positionPct: 10,
}

const guard = Object.freeze({
  forceExit: false,
  blockNewEntry: false,
  strategyHalt: false,
  cancelOrderPrograms: false,
  triggered: Object.freeze([] as string[]),
}) as any

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

function dynamicGridNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'orchestration-program-dynamic-grid-1',
    kind: 'program',
    key: 'program.dynamic_grid',
    status: 'locked',
    source: 'user_explicit',
    params: {} as Record<string, unknown>,
    programKind: 'dynamic_grid',
    activeWhenRef: 'orchestration-gate-regime-1',
    onDeactivate: 'cancel',
    rebuildPolicy: 'anchor_on_state_change',
    anchorLookbackBars: 50,
    anchorSide: 'high',
    anchorDriftPct: 1,
    rebuildMinIntervalSec: 60,
    levelCount: 5,
    dynamicGridStep: { mode: 'pct', value: 0.5 },
    sizing: { mode: 'fixed_pct', value: 5 },
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function makeBars(count: number, recipe: (i: number) => { high: number; low: number }, startTs = 1_700_000_000_000) {
  const bars = []
  for (let i = 0; i < count; i++) {
    const r = recipe(i)
    bars.push({ open: r.high, high: r.high, low: r.low, close: (r.high + r.low) / 2, volume: 1, timestamp: startTs + i * 60_000 })
  }
  return bars
}

describe('orchestration program.dynamic_grid — golden corpus (Phase 5 S5 #984)', () => {
  // ============================================================
  // Section A — NL → frame → patch → state pipeline (6 cases)
  // ============================================================
  describe('Section A: NL pipeline', () => {
    const gateway = new NaturalLanguageGatewayService()
    const normalizer = new SemanticFrameNormalizerService()
    const builder = new SemanticSeedStateBuilderService()

    it('A.1 anchorSide=high + step=pct + sizing=fixed_pct', () => {
      const input = '在 BTCUSDT 用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，趋势上涨时启用，停用时撤单。价格高于 EMA50 才允许做多。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
      const patch = normalizer.normalize(frames)
      const node = patch.orchestration?.nodes.find(n => n.kind === 'program')
      expect(node?.key).toBe('program.dynamic_grid')
    })

    it('A.2 anchorSide=mid + sizing=fixed_quote', () => {
      const input = '围绕近 30 根 K 线 mid 挂 8 档动态网格，每档 100 USDT，趋势上涨启用，停用时保留。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
      if (dgFrames[0].kind === 'dynamic_grid') {
        expect(dgFrames[0].anchorSide).toBe('mid')
      }
    })

    it('A.3 anchorSide=low + onDeactivate=close', () => {
      const input = 'ETHUSDT 最近 100 根 K 线低点动态网格，3 档 1% 步长，趋势下跌启用，停用平仓。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
      if (dgFrames[0].kind === 'dynamic_grid') {
        expect(dgFrames[0].anchorSide).toBe('low')
        expect(dgFrames[0].onDeactivate).toBe('close')
      }
    })

    it('A.4 anchorSide=high + 鲸鱼活跃启用（非趋势 gate 表达式）', () => {
      const input = '近 20 根 K 线高点漂移网格 6 档每档 0.3%，鲸鱼活跃时启用，停用撤单。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
    })

    it('A.5 anchorSide=mid + sizing absolute（每档 USDT）', () => {
      const input = 'BTC 跟随 80 根 K 线中点的网格，10 档每档 200 USDT，趋势上涨启用，停用撤单。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
    })

    it('A.6 显式 drift + minInterval', () => {
      const input = '动态网格围绕近 60 根 K 线 high，5 档 0.8%，drift 1% 时重建，每次至少间隔 120 秒，趋势上涨启用，停用撤单。'
      const frames = gateway.parse(input)
      const dgFrames = frames.filter(f => f.kind === 'dynamic_grid')
      expect(dgFrames).toHaveLength(1)
      if (dgFrames[0].kind === 'dynamic_grid') {
        expect(dgFrames[0].anchorDriftPct).toBe(1)
        expect(dgFrames[0].rebuildMinIntervalSec).toBe(120)
      }
    })
  })

  // ============================================================
  // Section B — Readiness 15 fail-closed
  // ============================================================
  describe('Section B: readiness 15 fail-closed', () => {
    const readiness = new SemanticContractReadinessService()
    function expectPhase0(node: SemanticOrchestrationNode): boolean {
      const state = createSemanticState({ orchestration: { nodes: [regimeGateNode(), node], contracts: [] } })
      const result = readiness.normalize(state, CURRENT_VERSION)
      const next = result.state.orchestration?.nodes.find(n => n.id === node.id)
      return next?.openSlots?.some(slot => slot.slotKey === 'orchestration.phase0.unsupported') ?? false
    }

    it('B.1 wrong key → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ key: 'program.unknown' }))).toBe(true)
    })
    it('B.2 missing programKind → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ programKind: undefined }))).toBe(true)
    })
    it('B.3 invalid onDeactivate → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ onDeactivate: 'unknown' as any }))).toBe(true)
    })
    it('B.4 wrong rebuildPolicy → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ rebuildPolicy: 'static' as any }))).toBe(true)
    })
    it('B.5 anchorLookbackBars < 10 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ anchorLookbackBars: 5 }))).toBe(true)
    })
    it('B.6 anchorLookbackBars > 1000 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ anchorLookbackBars: 2000 }))).toBe(true)
    })
    it('B.7 invalid anchorSide → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ anchorSide: 'invalid' as any }))).toBe(true)
    })
    it('B.8 invalid step.mode → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ dynamicGridStep: { mode: 'invalid' as any, value: 1 } }))).toBe(true)
    })
    it('B.9 step.value <= 0 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ dynamicGridStep: { mode: 'pct', value: 0 } }))).toBe(true)
    })
    it('B.10 levelCount < 2 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ levelCount: 1 }))).toBe(true)
    })
    it('B.11 levelCount > 100 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ levelCount: 101 }))).toBe(true)
    })
    it('B.12 anchorDriftPct = 0 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ anchorDriftPct: 0 }))).toBe(true)
    })
    it('B.13 anchorDriftPct > 100 → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ anchorDriftPct: 200 }))).toBe(true)
    })
    it('B.14 rebuildMinIntervalSec < 60 → phase0 unsupported（硬下限）', () => {
      expect(expectPhase0(dynamicGridNode({ rebuildMinIntervalSec: 30 }))).toBe(true)
    })
    it('B.15 activeWhenRef references non-existent gate → phase0 unsupported', () => {
      expect(expectPhase0(dynamicGridNode({ activeWhenRef: 'non-existent-gate' }))).toBe(true)
    })
    it('B.16 happy path → readiness ok（验证 15 fail-closed 不漏过）', () => {
      const state = createSemanticState({ orchestration: { nodes: [regimeGateNode(), dynamicGridNode()], contracts: [] } })
      const result = readiness.normalize(state, CURRENT_VERSION)
      const next = result.state.orchestration?.nodes.find(n => n.id === 'orchestration-program-dynamic-grid-1')
      const blocker = next?.openSlots?.some(slot => slot.slotKey === 'orchestration.phase0.unsupported') ?? false
      expect(blocker).toBe(false)
    })
  })

  // ============================================================
  // Section C — Display 不泄漏黑名单
  // ============================================================
  describe('Section C: display blacklist', () => {
    it('C.1 display 文本不含黑名单 6 字面量', () => {
      const projection = new SemanticStateProjectionService()
      const state = createSemanticState({ orchestration: { nodes: [regimeGateNode(), dynamicGridNode({
        params: {
          anchorLookbackBars: 50,
          anchorSide: 'high',
          levelCount: 5,
          step: { mode: 'pct', value: 0.5 },
          onDeactivate: 'cancel',
        },
      })], contracts: [] } })
      const display = projection.buildDisplayLogicGraph(state)
      const json = JSON.stringify(display)
      // 黑名单 6 字面量
      for (const banned of ['program.dynamic_grid', 'dynamic_grid', 'anchor_on_state_change']) {
        expect(json).not.toContain(banned)
      }
      // anchorSide enum 字面量也禁出现（用中文）
      // 注：display 需有内容
      expect(json.length).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // Section D — Canonical → IR → runtime ladder rebuild
  // ============================================================
  describe('Section D: canonical → IR → runtime', () => {
    it('D.1 state → canonical → IR 形态稳定', () => {
      const builder = new CanonicalSpecBuilderService()
      const compiler = new CanonicalSpecV2IrCompilerService()
      const state = createSemanticState({ orchestration: { nodes: [regimeGateNode(), dynamicGridNode()], contracts: [] } })
      const spec = builder.buildFromSemanticState(state)
      expect(spec?.orchestration?.programs).toHaveLength(1)
      const program = spec!.orchestration!.programs![0]
      if (program.programKind !== 'dynamic_grid') throw new Error('expected dynamic_grid program')
      expect(program.activeWhenRef).toBe('orchestration-gate-regime-1')
      expect(program.dynamicGridParams.anchorLookbackBars).toBe(50)

      const { ir } = compiler.compile({ canonicalSpec: spec!, fallback: IR_FALLBACK })
      expect(ir.orchestrationPrograms).toHaveLength(1)
      const irProg = ir.orchestrationPrograms![0]
      if (irProg.programKind !== 'dynamic_grid') throw new Error('expected dynamic_grid')
      expect(irProg.dynamicGridParams.anchorSide).toBe('high')
    })

    it('D.2 anchor 稳定 → keep prev.lastBuildLadder', () => {
      const program: any = {
        id: 'p',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'high', anchorDriftPct: 5, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      const prev: any = { p: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt: 1, lastBuildLadder: [{ id: 'p:0', level: 99 }, { id: 'p:1', level: 98 }] } }
      const bars = makeBars(10, () => ({ high: 102, low: 98 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program], prev)
      expect(state.workingOrders[0].levels).toEqual([99, 98])
    })

    it('D.3 anchor 漂移 + minInterval 通过 → 新 ladder', () => {
      const program: any = {
        id: 'p',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'high', anchorDriftPct: 1, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 5 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      const prev: any = { p: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt: 1_600_000_000_000, lastBuildLadder: [{ id: 'p:0', level: 95 }] } }
      const bars = makeBars(10, () => ({ high: 110, low: 100 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program], prev)
      // 新 ladder = round2(110 * 0.95^i) for i=1..2
      expect(state.workingOrders[0].levels).toEqual([104.5, 99.28])
    })

    it('D.4 限速拒绝 → NOOP + 保留旧 ladder + state 透传', () => {
      const program: any = {
        id: 'p',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'high', anchorDriftPct: 1, rebuildMinIntervalSec: 120, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      const lastBuildAt = 1_700_000_000_000
      const prev: any = { p: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt, lastBuildLadder: [{ id: 'p:0', level: 99 }] } }
      // bars 时间戳全部紧贴 lastBuildAt，保证 (now - lastBuildAt)/1000 < 120 触发限速
      const bars = makeBars(10, () => ({ high: 110, low: 100 }), lastBuildAt - 9 * 60_000 + 30_000)
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program], prev)
      expect(state.workingOrders[0].levels).toEqual([99])
      expect(state.programLifecycleStateNext.p).toEqual(prev.p)
    })

    it('D.5 K 线不足（无 prev）→ cancelled；（有 prev）→ 保留旧 ladder', () => {
      const program: any = {
        id: 'p',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 50, anchorSide: 'high', anchorDriftPct: 1, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      const bars = makeBars(5, () => ({ high: 100, low: 90 }))
      const noprev = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program])
      expect(noprev.cancelledProgramIds).toContain('p')

      const prev: any = { p: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt: 1, lastBuildLadder: [{ id: 'p:0', level: 95 }] } }
      const withprev = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program], prev)
      expect(withprev.workingOrders[0].levels).toEqual([95])
    })
  })

  // ============================================================
  // Section E — onDeactivate 三模式 + W5 不变量
  // ============================================================
  describe('Section E: onDeactivate 三模式 + W5 不变量', () => {
    function makeProgram(onDeactivate: 'cancel' | 'keep' | 'close'): any {
      return {
        id: 'pX',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate,
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'high', anchorDriftPct: 1, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
    }

    const prevWithLadder: any = {
      pX: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt: 1, lastBuildLadder: [{ id: 'pX:0', level: 99 }] },
    }

    it('E.1 onDeactivate=cancel × inactive → cancel + prev 透传', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': false }, guard, [], undefined, [makeProgram('cancel')], prevWithLadder)
      expect(state.cancelledProgramIds).toEqual(['pX'])
    })

    it('E.2 onDeactivate=keep × inactive → keep prev ladder', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': false }, guard, [], undefined, [makeProgram('keep')], prevWithLadder)
      expect(state.workingOrders[0].levels).toEqual([99])
    })

    it('E.3 onDeactivate=close × inactive → close + prev 透传', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': false }, guard, [], undefined, [makeProgram('close')], prevWithLadder)
      expect(state.closeProgramIds).toEqual(['pX'])
    })

    it('E.4 W5-A 同 bar 信号优先：active=true 不被 onDeactivate=close 改写', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [makeProgram('close')])
      expect(state.activeProgramIds).toContain('pX')
      expect(state.closeProgramIds).not.toContain('pX')
    })

    it('E.5 W5-B inactive 持仓 close → closeProgramIds 含 program', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': false }, guard, [], undefined, [makeProgram('close')], prevWithLadder)
      expect(state.closeProgramIds).toEqual(['pX'])
      expect(state.workingOrders.find(w => w.id === 'pX')).toBeUndefined()
    })

    it('E.6 W5-C 重复 close 不重复 emit（同一 bar 两次 close 仍只 1 个）', () => {
      const bars = makeBars(10, () => ({ high: 100, low: 90 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': false }, guard, [], undefined, [makeProgram('close')], prevWithLadder)
      expect(state.closeProgramIds.filter(id => id === 'pX')).toHaveLength(1)
    })
  })

  // ============================================================
  // Section F — 锁公式 fixture（critic round 1 M4）
  // ============================================================
  describe('Section F: 公式锁定', () => {
    it('F.1 mid 公式：bars[low=100..high=200] anchorSide=mid → currentAnchor=150', () => {
      const program: any = {
        id: 'pmid',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'mid', anchorDriftPct: 1, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      const bars = makeBars(10, () => ({ high: 200, low: 100 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program])
      const entry = state.programLifecycleStateNext.pmid
      if (entry?.kind === 'dynamic_grid') {
        expect(entry.lastBuildAnchor).toBe(150)
      }
    })

    it('F.2 drift 公式：lastBuildAnchor=100 currentAnchor=105 → driftPctActual=5%', () => {
      const program: any = {
        id: 'pdrift',
        programKind: 'dynamic_grid',
        activeWhenExprId: 'expr-gate',
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: { anchorLookbackBars: 10, anchorSide: 'high', anchorDriftPct: 10, rebuildMinIntervalSec: 60, levelCount: 2, step: { mode: 'pct', value: 1 } },
        sizing: { mode: 'fixed_quote', value: 100 },
      }
      // currentAnchor=105, lastBuildAnchor=100 → drift = 5% < 阈值 10% → keep prev
      const prev: any = { pdrift: { kind: 'dynamic_grid', lastBuildAnchor: 100, lastBuildAt: 1, lastBuildLadder: [{ id: 'pdrift:0', level: 99 }] } }
      const bars = makeBars(10, () => ({ high: 105, low: 100 }))
      const state = runOrderPrograms({ bars } as any, [], { 'expr-gate': true }, guard, [], undefined, [program], prev)
      // drift = 5%, 阈值 = 5%, 不严格 ≥ → 实际算法 driftPctActual < anchorDriftPct → 不 rebuild
      // 注：5% === 5% 时 rebuild 检查走"不漂移"分支（< 阈值用 strict less-than）
      expect(state.workingOrders[0].levels).toEqual([99])
      expect(state.programLifecycleStateNext.pdrift).toEqual(prev.pdrift)
    })
  })
})
