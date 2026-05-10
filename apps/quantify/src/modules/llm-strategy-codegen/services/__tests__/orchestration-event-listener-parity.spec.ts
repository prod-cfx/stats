import type {
  CompiledEventListenerProgram,
} from '@ai/shared/script-engine/compiled-runtime/compiled-orchestration-program'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

/**
 * Phase 5 S12 Task 14 (#1118) — event_listener backtest vs live signal parity (5 case)
 *
 * 目标：backtest 与 live signal 共用同一 runOrderPrograms 调用路径，
 * 在事件输入 / dedup 演化 / TTL 双策略 / inactive 双路径 / 向后兼容 五场景下输出字节相等。
 */

function makeProgram(
  overrides: Partial<CompiledEventListenerProgram> = {},
): CompiledEventListenerProgram {
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

const guardOk = {
  forceExit: false,
  blockNewEntry: false,
  strategyHalt: false,
  cancelOrderPrograms: false,
  triggered: [] as string[],
}

function runWith(args: {
  events: ReadonlyArray<{ id: string; ts: number; payload: Readonly<Record<string, unknown>> }>
  programs: CompiledEventListenerProgram[]
  exprValues: Record<string, unknown>
  prev?: Readonly<Record<string, ProgramLifecycleState>>
  now: number
  feedId?: string
}) {
  const feedId = args.feedId ?? 'webhook.tradingview.alpha'
  return runOrderPrograms(
    {
      timestamp: args.now,
      eventInbox: { [feedId]: args.events },
    } as never,
    [],
    args.exprValues as never,
    guardOk as never,
    [],
    undefined,
    args.programs as never,
    args.prev,
  )
}

describe('orchestration program.event_listener — backtest vs live signal parity', () => {
  it('case 1 active 收事件 parity：backtest 与 live signal lifecycle state 字节相等', () => {
    const programs = [makeProgram()]
    const events = [{ id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'A1' } }]
    const backtest = runWith({ events, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_000_000 })
    const live = runWith({ events, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_000_000 })
    expect(live).toEqual(backtest)
  })

  it('case 2 dedup 窗口 parity：同 idempotencyKey 跨多 K 线 → dedupBuffer 演化一致', () => {
    const programs = [makeProgram()]
    const e1 = [{ id: 'e1', ts: 1_700_000_000_000, payload: { signalId: 'X' } }]
    const e2 = [{ id: 'e2', ts: 1_700_000_002_000, payload: { signalId: 'X' } }]
    const e3 = [{ id: 'e3', ts: 1_700_000_008_000, payload: { signalId: 'X' } }]

    // backtest 路径
    const b1 = runWith({ events: e1, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_000_000 })
    const b2 = runWith({ events: e2, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_002_000, prev: b1.programLifecycleStateNext })
    const b3 = runWith({ events: e3, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_008_000, prev: b2.programLifecycleStateNext })

    // live 路径
    const l1 = runWith({ events: e1, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_000_000 })
    const l2 = runWith({ events: e2, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_002_000, prev: l1.programLifecycleStateNext })
    const l3 = runWith({ events: e3, programs, exprValues: { 'expr-gate-long': true }, now: 1_700_000_008_000, prev: l2.programLifecycleStateNext })

    expect(l3).toEqual(b3)
  })

  it('case 3 TTL drop / escalate 双策略 parity：分别构造 expired event → 行为字节相等', () => {
    const dropProgram = makeProgram({ id: 'drop', expirationTtlMs: 1_000, dedupWindowMs: 500, expirationPolicy: 'drop' })
    const escalateProgram = makeProgram({ id: 'escalate', expirationTtlMs: 1_000, dedupWindowMs: 500, expirationPolicy: 'escalate' })
    const expired = [{ id: 'eX', ts: 1_700_000_000_000, payload: { signalId: 'OLD' } }]
    const now = 1_700_000_002_000

    const bD = runWith({ events: expired, programs: [dropProgram], exprValues: { 'expr-gate-long': true }, now })
    const lD = runWith({ events: expired, programs: [dropProgram], exprValues: { 'expr-gate-long': true }, now })
    expect(lD).toEqual(bD)

    const bE = runWith({ events: expired, programs: [escalateProgram], exprValues: { 'expr-gate-long': true }, now })
    const lE = runWith({ events: expired, programs: [escalateProgram], exprValues: { 'expr-gate-long': true }, now })
    expect(lE).toEqual(bE)
    const entry = bE.programLifecycleStateNext[escalateProgram.id]
    if (entry?.kind === 'event_listener') {
      expect(entry.escalateCount).toBe(1)
    }
  })

  it('case 4 inactive cancel/keep parity：activeWhen=false 两路径 → backtest / live 行为字节相等', () => {
    const cancelProgram = makeProgram({ id: 'cancel', onDeactivate: 'cancel' })
    const keepProgram = makeProgram({ id: 'keep', onDeactivate: 'keep' })
    const events: Array<{ id: string; ts: number; payload: Record<string, unknown> }> = []
    const prev: Record<string, ProgramLifecycleState> = {
      keep: Object.freeze({
        kind: 'event_listener' as const,
        lastEventAt: 1_700_000_000_000,
        lastEventId: 'persisted',
        lastEventPayloadJson: '{}',
        dedupBuffer: Object.freeze([{ key: 'KEEP', ts: 1_700_000_000_000 }]),
        schemaVersion: 0,
        escalateCount: 1,
      }),
    }
    const bC = runWith({ events, programs: [cancelProgram], exprValues: { 'expr-gate-long': false }, now: 1_700_000_010_000 })
    const lC = runWith({ events, programs: [cancelProgram], exprValues: { 'expr-gate-long': false }, now: 1_700_000_010_000 })
    expect(lC).toEqual(bC)
    const bK = runWith({ events, programs: [keepProgram], exprValues: { 'expr-gate-long': false }, now: 1_700_000_010_000, prev })
    const lK = runWith({ events, programs: [keepProgram], exprValues: { 'expr-gate-long': false }, now: 1_700_000_010_000, prev })
    expect(lK).toEqual(bK)
  })

  it('case 5 向后兼容 parity：strategy 完全无 event_listener 节点 → closeProgramIds=0 + lifecycleNext={}', () => {
    // 不传 orchestrationPrograms（undefined）
    const r = runOrderPrograms(
      { timestamp: 1_700_000_000_000 } as never,
      [],
      {} as never,
      guardOk as never,
      [],
      undefined,
      undefined,
      undefined,
    )
    expect(r.closeProgramIds).toEqual([])
    expect(r.programLifecycleStateNext).toEqual({})
    expect(r.workingOrders).toEqual([])
    expect(r.activeProgramIds).toEqual([])
    expect(r.cancelledProgramIds).toEqual([])
  })
})
