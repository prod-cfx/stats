import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import type {
  CompiledEventListenerProgram,
} from '@ai/shared/script-engine/compiled-runtime/compiled-orchestration-program'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { renderLegacyDisplay } from '../legacy-presentation-data'

/**
 * Phase 5 S12 Task 16 (#1118) — program.event_listener golden corpus.
 *
 * 14+ cases 5 段：
 *   - 6 NL pipeline
 *   - 6 readiness 16 fail-closed 抽样
 *   - 1 display 黑名单
 *   - 1 canonical → runtime（active 收事件 → lastEventId / payloadJson）
 *   - 4 dedup 滚动窗口正确性
 *   - 1 G1 多 listener 共 feed 隔离
 *   - 1 G2 stable-sort
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

function dataSourceEventScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'orchestration-scope-data-source-1',
    kind: 'scope',
    key: 'scope.dataSource',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    dataSourceScopeKind: 'dataSource',
    dataSourceRole: 'event',
    dataSourceFeedId: 'webhook.tradingview.alpha',
    dataSourceSchemaRef: 'webhook_event',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function eventListenerNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'orchestration-program-event-listener-1',
    kind: 'program',
    key: 'program.event_listener',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    programKind: 'event_listener',
    activeWhenRef: 'orchestration-gate-regime-1',
    onDeactivate: 'cancel',
    rebuildPolicy: 'static',
    eventSchemaRef: 'webhook_event',
    sourceRef: 'orchestration-scope-data-source-1',
    permissionScope: 'tradingview:alpha',
    idempotencyKey: { fieldPath: 'signalId' },
    dedupWindowMs: 5_000,
    expirationTtlMs: 60_000,
    expirationPolicy: 'drop',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function expectPhase0(node: SemanticOrchestrationNode): boolean {
  return (node.openSlots ?? []).some(s => s.slotKey === 'orchestration.phase0.unsupported')
}

describe('orchestration program.event_listener — golden corpus (Phase 5 S12 #1118)', () => {
  const readiness = new SemanticContractReadinessService()

  // ============ Section A — NL pipeline (6 cases) ============
  describe('Section A: NL pipeline', () => {
    const gateway = new NaturalLanguageGatewayService()
    const normalizer = new SemanticFrameNormalizerService()

    const utterances: Array<[string, string, { fieldPath: string; provider: string }]> = [
      [
        'A.1 tradingview 显式 dedupWindow + drop',
        '订阅 tradingview 事件，事件监听信号触发，去重 5 秒，过期 60 秒丢弃',
        { fieldPath: 'signalId', provider: 'tradingview' },
      ],
      [
        'A.2 discord 默认 fieldPath',
        'discord 事件监听 webhook 信号触发',
        { fieldPath: 'signalId', provider: 'discord' },
      ],
      [
        'A.3 telegram 显式 fieldPath 单层',
        'telegram 事件监听信号 按 messageId 去重 10 秒',
        { fieldPath: 'messageId', provider: 'telegram' },
      ],
      [
        'A.4 webhook 显式一层下钻 fieldPath',
        'webhook 事件监听信号 按 data.signalId 去重 5 秒',
        { fieldPath: 'data.signalId', provider: 'webhook' },
      ],
      [
        'A.5 多 provider 误触防御（缺锚词不进 frame）',
        'tradingview 看图分析，价格高于 EMA50 开多',
        { fieldPath: 'signalId', provider: 'tradingview' },
      ],
      [
        'A.6 rebuildPolicy on_schema_version_bump',
        '订阅 tradingview 事件监听信号触发 schema 版本变更时清空',
        { fieldPath: 'signalId', provider: 'tradingview' },
      ],
    ]

    for (const [name, input, expected] of utterances) {
      it(name, () => {
        const frames = gateway.parse(input)
        const eventFrames = frames.filter(f => f.kind === 'event_listener')
        if (name.startsWith('A.5')) {
          // 防误触：缺信号语义 → frame 不抽
          expect(eventFrames.length).toBe(0)
          return
        }
        expect(eventFrames.length).toBeGreaterThan(0)
        const f = eventFrames[0]
        if (f.kind !== 'event_listener') throw new Error('frame kind mismatch')
        expect(f.idempotencyKey.fieldPath).toBe(expected.fieldPath)
        expect(f.permissionScope.startsWith(expected.provider)).toBe(true)
        const patch = normalizer.normalize(frames)
        const programNodes = patch.orchestration?.nodes?.filter(
          n => n.kind === 'program' && n.key === 'program.event_listener',
        ) ?? []
        expect(programNodes.length).toBe(1)
        if (name.startsWith('A.6')) {
          const node = programNodes[0]
          expect((node as { rebuildPolicy: string }).rebuildPolicy).toBe('on_schema_version_bump')
        }
      })
    }
  })

  // ============ Section B — Readiness 16 fail-closed 抽样 ============
  describe('Section B: readiness 16 fail-closed 抽样', () => {
    const variations: Array<[string, Partial<SemanticOrchestrationNode>]> = [
      ['#1 缺 eventSchemaRef → fail-closed', { eventSchemaRef: undefined }],
      ['#2 sourceRef 引用 dataSource role 非 event', {}],
      ['#3 expirationTtlMs == dedupWindowMs 边界（严格大于）', { dedupWindowMs: 60_000, expirationTtlMs: 60_000 }],
      ['#4 permissionScope 格式非法', { permissionScope: 'INVALID UPPER' }],
      ['#5 activeWhenRef 引用 gate 未通过 readiness', {}],
      ['#6 idempotencyKey.fieldPath 多层下钻', { idempotencyKey: { fieldPath: 'a.b.c' } }],
    ]
    for (const [name, override] of variations) {
      it(name, () => {
        const dsScope = name.includes('#2')
          ? dataSourceEventScopeNode({ dataSourceRole: 'primary' })
          : dataSourceEventScopeNode()
        const gate = name.includes('#5')
          ? regimeGateNode({ status: 'open' })
          : regimeGateNode()
        const target = eventListenerNode(override)
        const state = createSemanticState({
          orchestration: [gate, dsScope, target], orchestrationContracts: [],
        })
        const result = readiness.normalize(state, CURRENT_VERSION)
        const node = result.state.orchestration.find(n => n.id === target.id)
        expect(node).toBeDefined()
        expect(expectPhase0(node!)).toBe(true)
      })
    }
  })

  // ============ Section C — Display 黑名单（不污染 + 正向 grep）============
  describe('Section C: display 黑名单', () => {
    it('C.1 display 文本不泄漏内部 key（负 grep）+ 保留 provider 友好标签（正 grep）', () => {
      const display = renderLegacyDisplay('program.event_listener', {
        permissionScope: 'tradingview:alpha',
      })
      // 负 grep
      expect(display).not.toMatch(/program\.event_listener/)
      expect(display).not.toMatch(/event_listener/)
      expect(display).not.toMatch(/webhook_event/)
      expect(display).not.toMatch(/on_schema_version_bump/)
      expect(display).not.toMatch(/dedupWindowMs/)
      // 正 grep — provider 段保留为人类标签
      expect(display).toMatch(/事件监听/)
      expect(display).toMatch(/TradingView/)
    })
  })

  // ============ Section D — canonical → runtime: active 收事件 ============
  describe('Section D: canonical → runtime', () => {
    const guardOk = {
      forceExit: false,
      blockNewEntry: false,
      strategyHalt: false,
      cancelOrderPrograms: false,
      triggered: [] as string[],
    }

    function makeProgram(overrides: Partial<CompiledEventListenerProgram> = {}): CompiledEventListenerProgram {
      return {
        id: 'event-listener-1',
        programKind: 'event_listener',
        activeWhenExprId: 'expr-gate-long',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
        eventSchemaRef: 'webhook_event',
        sourceFeedId: 'webhook.tradingview.alpha',
        permissionScope: 'tradingview:alpha',
        idempotencyKey: { fieldPath: 'signalId' },
        dedupWindowMs: 5_000,
        expirationTtlMs: 60_000,
        expirationPolicy: 'drop',
        ...overrides,
      }
    }

    it('D.1 完整 supported listener 串到 runtime active 接收一个事件 → lastEventId / lastEventPayloadJson 写入', () => {
      const program = makeProgram()
      const events = [
        { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1', side: 'long' } },
      ]
      const ctx = {
        timestamp: 1_700_000_000_000,
        eventInbox: { 'webhook.tradingview.alpha': events },
      }
      const state = runOrderPrograms(
        ctx as never,
        [],
        { 'expr-gate-long': true } as never,
        guardOk as never,
        [],
        undefined,
        [program] as never,
      )
      expect(state.workingOrders).toEqual([])
      expect(state.closeProgramIds).toEqual([])
      const entry = state.programLifecycleStateNext[program.id]
      expect(entry?.kind).toBe('event_listener')
      if (entry?.kind === 'event_listener') {
        expect(entry.lastEventId).toBe('e1')
        expect(entry.lastEventPayloadJson).toBe(canonicalSerialize({ signalId: 'A1', side: 'long' }))
      }
    })

    // ============ Section E — dedup 滚动窗口正确性（独立 4 case）============
    it('E.1 连续 3 事件同 key (ts1 / ts1+2s / ts1+8s, dedupWindow=5s) → 第 1 写、第 2 dedup、第 3 写（窗外）', () => {
      const program = makeProgram({ dedupWindowMs: 5_000, expirationTtlMs: 60_000 })
      const ctxAt = (now: number, evs: Array<{ id: string; ts: number; payload: Record<string, unknown> }>) => ({
        timestamp: now, eventInbox: { 'webhook.tradingview.alpha': evs },
      })
      // bar 1: ts1
      const r1 = runOrderPrograms(
        ctxAt(1_700_000_000_000, [{ id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A' } }]) as never,
        [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
      )
      // bar 2: ts1+2s — dedup 命中
      const r2 = runOrderPrograms(
        ctxAt(1_700_000_002_000, [{ id: 'e2', ts: 1_700_000_002_000, payload: { signalId: 'A' } }]) as never,
        [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
        r1.programLifecycleStateNext,
      )
      const e2 = r2.programLifecycleStateNext[program.id]
      if (e2?.kind === 'event_listener') {
        expect(e2.lastEventId).toBe('e1')
      }
      // bar 3: ts1+8s — 窗外，新事件写入
      const r3 = runOrderPrograms(
        ctxAt(1_700_000_008_000, [{ id: 'e3', ts: 1_700_000_008_000, payload: { signalId: 'A' } }]) as never,
        [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
        r2.programLifecycleStateNext,
      )
      const e3 = r3.programLifecycleStateNext[program.id]
      if (e3?.kind === 'event_listener') {
        expect(e3.lastEventId).toBe('e3')
      }
    })

    it('E.2 边界严格 `>`：ts1+exactly-dedupWindowMs → 滚出（M2）', () => {
      const program = makeProgram({ dedupWindowMs: 5_000, expirationTtlMs: 60_000 })
      const prev: ProgramLifecycleState = Object.freeze({
        kind: 'event_listener' as const,
        lastEventAt: 1_700_000_000_000,
        lastEventId: 'old',
        lastEventPayloadJson: '{}',
        dedupBuffer: Object.freeze([{ key: 'A', ts: 1_700_000_000_000 }]),
        schemaVersion: 0,
        escalateCount: 0,
      })
      const ctx = {
        timestamp: 1_700_000_005_000,
        eventInbox: { 'webhook.tradingview.alpha': [{ id: 'e_new', ts: 1_700_000_005_000, payload: { signalId: 'A' } }] },
      }
      const r = runOrderPrograms(
        ctx as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
        { [program.id]: prev },
      )
      const entry = r.programLifecycleStateNext[program.id]
      if (entry?.kind === 'event_listener') {
        expect(entry.lastEventId).toBe('e_new')
      }
    })

    it('E.3 同 ts 同 key 两个事件 → 第二个 dedup 命中（先到先得）', () => {
      const program = makeProgram()
      const ctx = {
        timestamp: 1_700_000_000_000,
        eventInbox: {
          'webhook.tradingview.alpha': [
            { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A' } },
            { id: 'e2', ts: 1_700_000_000_000, payload: { signalId: 'A' } },
          ],
        },
      }
      const r = runOrderPrograms(
        ctx as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
      )
      const entry = r.programLifecycleStateNext[program.id]
      if (entry?.kind === 'event_listener') {
        expect(entry.lastEventId).toBe('e1')
      }
    })

    it('E.4 dedupBuffer 容量 LRU：注入 1025 唯一 key → buffer 长度恒为 1024', () => {
      const program = makeProgram({ dedupWindowMs: 3_600_000, expirationTtlMs: 86_400_000 })
      const events = Array.from({ length: 1025 }, (_, i) => ({
        id: `e${i}`,
        ts: 1_700_000_000_000 + i,
        payload: { signalId: `K${i}` },
      }))
      const ctx = {
        timestamp: 1_700_000_001_500,
        eventInbox: { 'webhook.tradingview.alpha': events },
      }
      const r = runOrderPrograms(
        ctx as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined, [program] as never,
      )
      const entry = r.programLifecycleStateNext[program.id]
      if (entry?.kind === 'event_listener') {
        expect(entry.dedupBuffer.length).toBe(1024)
      }
    })

    // ============ Section F — G1 多 listener 共 feed 隔离 ============
    it('F.1 单 feed × 双 listener × 同 idempotencyKey → 两个 lifecycle entry 各自独立 dedup', () => {
      const p1 = makeProgram({ id: 'listener-A' })
      const p2 = makeProgram({ id: 'listener-B' })
      const events = [
        { id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A' } },
      ]
      const ctx = {
        timestamp: 1_700_000_000_000,
        eventInbox: { 'webhook.tradingview.alpha': events },
      }
      const r = runOrderPrograms(
        ctx as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined,
        [p1, p2] as never,
      )
      const e1 = r.programLifecycleStateNext[p1.id]
      const e2 = r.programLifecycleStateNext[p2.id]
      expect(e1?.kind).toBe('event_listener')
      expect(e2?.kind).toBe('event_listener')
      if (e1?.kind === 'event_listener' && e2?.kind === 'event_listener') {
        // 两个 entry 各自独立持有 dedupBuffer 引用（非共享）
        expect(e1).not.toBe(e2)
        expect(e1.lastEventId).toBe('e1')
        expect(e2.lastEventId).toBe('e1')
      }
    })

    // ============ Section G — G2 stable-sort 输入未排序 → 输出确定 ============
    it('G.1 fixture 输入未排序 events → 按 ts 排序后处理（输出与有序输入字节相等）', () => {
      const program = makeProgram()
      const orderedEvents = [
        { id: 'e1', ts: 1_700_000_000_100, payload: { signalId: 'A' } },
        { id: 'e2', ts: 1_700_000_000_200, payload: { signalId: 'B' } },
        { id: 'e3', ts: 1_700_000_000_300, payload: { signalId: 'C' } },
      ]
      const shuffledEvents = [orderedEvents[2], orderedEvents[0], orderedEvents[1]]
      const ctxAt = (evs: typeof orderedEvents) => ({
        timestamp: 1_700_000_000_500,
        eventInbox: { 'webhook.tradingview.alpha': evs },
      })
      const rOrdered = runOrderPrograms(
        ctxAt(orderedEvents) as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined,
        [program] as never,
      )
      const rShuffled = runOrderPrograms(
        ctxAt(shuffledEvents) as never, [], { 'expr-gate-long': true } as never, guardOk as never, [], undefined,
        [program] as never,
      )
      expect(rShuffled.programLifecycleStateNext[program.id]).toEqual(rOrdered.programLifecycleStateNext[program.id])
    })
  })
})
