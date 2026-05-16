import type { SemanticRule } from '../../types/atom-expr'
import type {
  SemanticPositionConstraintState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import { SemanticExecutableSemanticsService } from '../semantic-executable-semantics.service'
import { SemanticMissingPlaceholderReconcilerService } from '../semantic-missing-placeholder-reconciler.service'

describe('SemanticMissingPlaceholderReconcilerService', () => {
  // Issue #1383 Lane A：reconciler 现注入 SemanticExecutableSemanticsService 完成
  //   registry-driven 判定；spec 同步切到注入构造。
  const service = new SemanticMissingPlaceholderReconcilerService(new SemanticExecutableSemanticsService())

  it('removes an open missing entry placeholder when a real entry trigger exists', () => {
    const state = createSemanticState({
      trigger: [
        createMissingPlaceholder('entry'),
        createTrigger({ id: 'trigger-entry', key: 'indicator.cross_over', phase: 'entry' }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).not.toBe(state)
    expect(nextState.trigger).toEqual([
      createTrigger({ id: 'trigger-entry', key: 'indicator.cross_over', phase: 'entry' }),
    ])
  })

  it('keeps an open missing entry placeholder when only an entry action exists', () => {
    const state = createSemanticState({
      trigger: [createMissingPlaceholder('entry')],
      action: [{
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })

    const nextState = service.reconcile(state)

    expect(nextState).toBe(state)
    expect(nextState.trigger).toEqual([createMissingPlaceholder('entry')])
  })

  it('removes an open missing exit placeholder when a real exit trigger exists', () => {
    const state = createSemanticState({
      trigger: [
        createMissingPlaceholder('exit'),
        createTrigger({ id: 'trigger-exit', key: 'indicator.cross_under', phase: 'exit' }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).not.toBe(state)
    expect(nextState.trigger).toEqual([
      createTrigger({ id: 'trigger-exit', key: 'indicator.cross_under', phase: 'exit' }),
    ])
  })

  describe('Issue #1395 — grid + breakout false-positive fix', () => {
    const executable = new SemanticExecutableSemanticsService()

    it('grid.range_rebalance positionConstraint = executable entry (no missing_entry_atom)', () => {
      const state = createSemanticState({
        positionConstraint: [createGridConstraint({
          rangeLower: 79200,
          rangeUpper: 80200,
          sideMode: 'both',
        })],
      })
      expect(executable.hasExecutableEntrySemantics(state)).toBe(true)
    })

    it('grid + breakoutAction=stop = executable exit (no missing_exit_atom)', () => {
      const state = createSemanticState({
        positionConstraint: [createGridConstraint({
          rangeLower: 79200,
          rangeUpper: 80200,
          sideMode: 'both',
          breakoutAction: 'stop',
        })],
      })
      expect(executable.hasExecutableExitSemantics(state)).toBe(true)
    })

    it('rules[] entry rule = executable entry (#1395)', () => {
      const rules: SemanticRule[] = [{
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lt', params: { threshold: 30 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }]
      const state = createSemanticState({ rules })
      expect(executable.hasExecutableEntrySemantics(state)).toBe(true)
    })

    it('rules[] exit rule = executable exit (#1395)', () => {
      const rules: SemanticRule[] = [{
        id: 'r2',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_gt', params: { threshold: 70 } },
        effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
      }]
      const state = createSemanticState({ rules })
      expect(executable.hasExecutableExitSemantics(state)).toBe(true)
    })

    it('reconciler drops both missing placeholders for S1 grid + breakoutAction=stop', () => {
      const state = createSemanticState({
        trigger: [
          createMissingPlaceholder('entry'),
          createMissingPlaceholder('exit'),
        ],
        positionConstraint: [createGridConstraint({
          rangeLower: 79200,
          rangeUpper: 80200,
          sideMode: 'both',
          breakoutAction: 'stop',
        })],
      })

      const next = service.reconcile(state)

      expect(next.trigger).toEqual([])
    })
  })

  it('keeps missing placeholders when the matching real trigger is still open', () => {
    const openSlot = createOpenSlot()
    const state = createSemanticState({
      trigger: [
        createMissingPlaceholder('entry'),
        createTrigger({
          id: 'trigger-entry-open',
          key: 'indicator.cross_over',
          phase: 'entry',
          status: 'open',
          openSlots: [openSlot],
        }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).toBe(state)
    expect(nextState.trigger).toEqual([
      createMissingPlaceholder('entry'),
      createTrigger({
        id: 'trigger-entry-open',
        key: 'indicator.cross_over',
        phase: 'entry',
        status: 'open',
        openSlots: [openSlot],
      }),
    ])
  })
})

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
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  }
}

function createTrigger(input: {
  id: string
  key: string
  phase: SemanticTriggerState['phase']
  status?: SemanticTriggerState['status']
  openSlots?: SemanticSlotState[]
}): SemanticTriggerState {
  return {
    id: input.id,
    key: input.key,
    phase: input.phase,
    params: {},
    status: input.status ?? 'locked',
    source: 'user_explicit',
    openSlots: input.openSlots ?? [],
  }
}

function createMissingPlaceholder(
  phase: Extract<SemanticTriggerState['phase'], 'entry' | 'exit'>,
): SemanticTriggerState {
  const isEntry = phase === 'entry'
  return {
    id: `semantic-missing-${phase}-atom`,
    key: isEntry ? 'semantic.missing_entry_atom' : 'semantic.missing_exit_atom',
    phase,
    params: {},
    status: 'open',
    source: 'derived',
    openSlots: [{
      slotKey: isEntry ? 'trigger.entry' : 'trigger.exit',
      fieldPath: isEntry ? 'triggers[entry]' : 'triggers[exit]',
      status: 'open',
      priority: 'core',
      questionHint: isEntry ? '请补充入场触发条件。' : '请补充出场触发条件。',
      affectsExecution: true,
    }],
  }
}

function createGridConstraint(params: {
  rangeLower: number
  rangeUpper: number
  sideMode: 'both' | 'long' | 'short'
  breakoutAction?: 'stop' | 'pause' | 'continue'
}): SemanticPositionConstraintState {
  return {
    id: 'pc-1',
    key: 'grid.range_rebalance',
    params,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function createOpenSlot(): SemanticSlotState {
  return {
    slotKey: 'trigger.entry.condition',
    fieldPath: 'triggers[trigger-entry-open].params.condition',
    status: 'open',
    priority: 'core',
    questionHint: '请补充入场触发条件。',
    affectsExecution: true,
  }
}
